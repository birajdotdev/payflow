package com.payflow.backend.payment.service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import com.payflow.backend.auth.service.CurrentUserService;
import com.payflow.backend.common.exception.FinancialException;
import com.payflow.backend.merchant.entity.Merchant;
import com.payflow.backend.merchant.service.MerchantService;
import com.payflow.backend.payment.dto.*;
import com.payflow.backend.payment.entity.PaymentRequest;
import com.payflow.backend.payment.repository.PaymentRequestRepository;
import com.payflow.backend.transaction.dto.TransactionResponse;
import com.payflow.backend.transaction.entity.*;
import com.payflow.backend.transaction.repository.TransactionRepository;
import com.payflow.backend.user.entity.*;
import com.payflow.backend.wallet.entity.Wallet;
import com.payflow.backend.wallet.repository.WalletRepository;
import com.payflow.backend.wallet.service.DepositService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PaymentService {

    private final CurrentUserService currentUser;

    private final MerchantService merchants;

    private final PaymentRequestRepository requests;

    private final WalletRepository wallets;

    private final TransactionRepository transactions;

    @Transactional
    public PaymentRequestResponse create(CreatePaymentRequest input) {
        var m = merchants.requireOwned();
        active(m);

        var expiry = input.expiresAt() == null ? Instant.now().plus(24, ChronoUnit.HOURS) : input.expiresAt();

        if (input.amount() == null || input.amount().signum() <= 0 || input.amount().scale() > 2
                || input.amount().compareTo(DepositService.MAX_BALANCE) > 0 || !expiry.isAfter(Instant.now()))
            throw new FinancialException(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "Invalid amount or expiration.");

        return PaymentRequestResponse.from(
                requests.saveAndFlush(new PaymentRequest(m.getId(), input.amount(), input.description(), expiry)), m,
                null);
    }

    public PaymentRequestPage list(int page, int size) {
        var m = merchants.requireOwned();
        var results = requests.findByMerchantId(m.getId(), MerchantService.pageRequest(page, size));

        var content = results.getContent().stream().map(p -> response(p, m, m.getWalletId())).toList();

        return new PaymentRequestPage(content, page, size, results.getTotalElements(), results.getTotalPages(),
                results.hasNext());
    }

    public PaymentRequestResponse detail(UUID id) {
        var walletId = wallets.findIdByUserId(currentUser.requireCurrentUser().getId()).orElseThrow();
        var p = requests.findById(id).orElseThrow(PaymentService::missing);

        return response(p, merchants.find(p.getMerchantId()), walletId);
    }

    private PaymentRequestResponse response(PaymentRequest p, Merchant m, UUID viewerWallet) {
        // A shareable request never discloses a payer's receipt to another customer.
        var id = transactions.findByPaymentRequestId(p.getId())
            .filter(t -> viewerWallet.equals(t.getSenderWalletId()) || viewerWallet.equals(t.getReceiverWalletId()))
            .map(FinancialTransaction::getId)
            .orElse(null);

        return PaymentRequestResponse.from(p, m, id);
    }

    @Transactional
    public PaymentRequestResponse cancel(UUID id) {
        var m = merchants.requireOwned();
        var p = requests.findByIdForUpdate(id).orElseThrow(PaymentService::missing);

        if (!p.getMerchantId().equals(m.getId()))
            throw missing();

        if (p.effectiveStatus().equals("CANCELLED"))
            return response(p, m, m.getWalletId());

        payable(p);
        p.cancel();

        return PaymentRequestResponse.from(p, m, null);
    }

    @Transactional
    public TransactionResponse pay(UUID id, String key) {
        var owner = currentUser.requireCurrentUser();

        if (owner.getRole() != UserRole.USER && owner.getRole() != UserRole.MERCHANT)
            throw new FinancialException(HttpStatus.FORBIDDEN, "FORBIDDEN", "A customer wallet is required.");

        if (key == null || !key.matches("[A-Za-z0-9_-]{1,128}"))
            throw new FinancialException(HttpStatus.BAD_REQUEST, "INVALID_REQUEST",
                    "A valid Idempotency-Key is required.");

        // Global order: one request lock, then wallets in UUID order. No financial
        // flow acquires a request after a wallet; different-key/different-payer
        // attempts for this request serialize before deciding whether it is payable.
        var p = requests.findByIdForUpdate(id).orElseThrow(PaymentService::missing);
        var m = merchants.find(p.getMerchantId());

        UUID senderId = wallets.findIdByUserId(owner.getId()).orElseThrow();
        UUID receiverId = m.getWalletId();

        if (senderId.equals(receiverId))
            throw new FinancialException(HttpStatus.BAD_REQUEST, "SELF_PAYMENT",
                    "Cannot pay your own merchant request.");

        boolean senderFirst = senderId.compareTo(receiverId) < 0;

        var first = lock(senderFirst ? senderId : receiverId);
        var second = lock(senderFirst ? receiverId : senderId);

        var sender = senderFirst ? first : second;
        var receiver = senderFirst ? second : first;

        var previous = transactions.findBySenderWalletIdAndTypeAndIdempotencyKey(senderId,
                TransactionType.MERCHANT_PAYMENT, key);

        if (previous.isPresent()) {
            if (!id.equals(previous.get().getPaymentRequestId()))
                throw new FinancialException(HttpStatus.CONFLICT, "IDEMPOTENCY_CONFLICT",
                        "This key belongs to another payment request.");

            return TransactionResponse.from(previous.get());
        }

        payable(p);
        active(m);

        if (receiver.getUser().getStatus() != UserStatus.ACTIVE || receiver.getUser().getRole() != UserRole.MERCHANT)
            throw new FinancialException(HttpStatus.CONFLICT, "MERCHANT_SUSPENDED", "Merchant is unavailable.");

        sender.transferTo(receiver, p.getAmount());
        wallets.flush();

        var t = transactions.saveAndFlush(
                FinancialTransaction.merchantPayment(senderId, receiverId, id, p.getAmount(), p.getDescription(), key));
        p.markPaid();
        requests.flush();

        return TransactionResponse.from(t);
    }

    @Transactional
    public TransactionResponse refund(UUID id, String key) {
        var merchant = merchants.requireOwned();

        if (key == null || !key.matches("[A-Za-z0-9_-]{1,128}"))
            throw new FinancialException(HttpStatus.BAD_REQUEST, "INVALID_REQUEST",
                    "A valid Idempotency-Key is required.");

        var original = transactions.findById(id)
            .orElseThrow(
                    () -> new FinancialException(HttpStatus.NOT_FOUND, "TRANSACTION_NOT_FOUND", "Payment not found."));

        if (!merchant.getWalletId().equals(original.getReceiverWalletId()))
            throw new FinancialException(HttpStatus.NOT_FOUND, "TRANSACTION_NOT_FOUND", "Payment not found.");

        if (original.getType() != TransactionType.MERCHANT_PAYMENT || original.getStatus() != TransactionStatus.SUCCESS)
            throw new FinancialException(HttpStatus.CONFLICT, "REFUND_INELIGIBLE",
                    "Only successful merchant payments can be refunded.");

        // Original payment fields are immutable. All competing refunds serialize
        // through the same participant wallets; no request/transaction lock is
        // acquired after a wallet, avoiding lock-order cycles with payments.
        UUID senderId = merchant.getWalletId();
        UUID receiverId = original.getSenderWalletId();

        boolean senderFirst = senderId.compareTo(receiverId) < 0;
        var first = lock(senderFirst ? senderId : receiverId);
        var second = lock(senderFirst ? receiverId : senderId);

        var sender = senderFirst ? first : second;
        var receiver = senderFirst ? second : first;

        var previous = transactions.findBySenderWalletIdAndTypeAndIdempotencyKey(senderId, TransactionType.REFUND, key);

        if (previous.isPresent()) {
            if (!id.equals(previous.get().getOriginalPaymentId()))
                throw new FinancialException(HttpStatus.CONFLICT, "IDEMPOTENCY_CONFLICT",
                        "This key belongs to another refund.");

            return TransactionResponse.from(previous.get());
        }

        if (transactions.findByOriginalPaymentId(id).isPresent())
            throw new FinancialException(HttpStatus.CONFLICT, "PAYMENT_ALREADY_REFUNDED",
                    "Payment has already been refunded.");

        active(merchant);

        if (sender.getUser().getStatus() != UserStatus.ACTIVE || receiver.getUser().getStatus() != UserStatus.ACTIVE
                || sender.getUser().getRole() != UserRole.MERCHANT
                || (receiver.getUser().getRole() != UserRole.USER && receiver.getUser().getRole() != UserRole.MERCHANT))
            throw new FinancialException(HttpStatus.CONFLICT, "ACCOUNT_UNAVAILABLE",
                    "A payment participant is unavailable.");

        sender.transferTo(receiver, original.getAmount());
        wallets.flush();

        return TransactionResponse.from(transactions.saveAndFlush(FinancialTransaction.refund(original, key)));
    }

    private Wallet lock(UUID id) {
        return wallets.findByIdForUpdate(id).orElseThrow();
    }

    private static void active(Merchant m) {
        if (!m.getStatus().equals("ACTIVE"))
            throw new FinancialException(HttpStatus.CONFLICT, "MERCHANT_SUSPENDED", "Merchant is unavailable.");
    }

    private static void payable(PaymentRequest p) {
        String status = p.effectiveStatus();

        if (!status.equals("PENDING"))
            throw new FinancialException(HttpStatus.CONFLICT, "PAYMENT_REQUEST_" + status,
                    "Payment request is " + status.toLowerCase() + ".");
    }

    private static FinancialException missing() {
        return new FinancialException(HttpStatus.NOT_FOUND, "PAYMENT_REQUEST_NOT_FOUND", "Payment request not found.");
    }

}
