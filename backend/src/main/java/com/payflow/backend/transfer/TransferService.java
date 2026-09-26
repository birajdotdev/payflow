package com.payflow.backend.transfer;

import com.payflow.backend.auth.CurrentUserService;
import com.payflow.backend.common.exception.FinancialException;
import com.payflow.backend.transaction.*;
import com.payflow.backend.wallet.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Objects;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TransferService {
    private final CurrentUserService currentUserService;
    private final WalletRepository wallets;
    private final TransactionRepository transactions;

    @Transactional
    public TransferResponse transfer(TransferRequest request, String key) {
        var owner = currentUserService.requireCurrentUser();
        var amount = request.amount();
        if (request.receiverWalletId() == null || amount == null || amount.signum() <= 0
                || amount.scale() > 2 || amount.compareTo(DepositService.MAX_BALANCE) > 0
                || (request.description() != null && request.description().length() > 255)) {
            throw new FinancialException(HttpStatus.BAD_REQUEST, "INVALID_REQUEST",
                    "Receiver is required, amount must be NPR 0.01 to 1000000.00 with at most two decimal places, and description at most 255 characters.");
        }
        if (key == null || !key.matches("[A-Za-z0-9_-]{1,128}")) {
            throw new FinancialException(HttpStatus.BAD_REQUEST, "INVALID_REQUEST",
                    "Idempotency-Key must contain 1 to 128 letters, digits, underscores or hyphens.");
        }
        // Read only the ID: loading the entity before locking could retain a stale balance in JPA.
        UUID senderId = wallets.findIdByUserId(owner.getId())
                .orElseThrow(() -> new IllegalStateException("Primary wallet is missing."));
        UUID receiverId = request.receiverWalletId();
        if (senderId.equals(receiverId)) {
            throw new FinancialException(HttpStatus.BAD_REQUEST, "SELF_TRANSFER", "Cannot transfer to the same wallet.");
        }
        boolean senderFirst = senderId.compareTo(receiverId) < 0;
        var first = lock(senderFirst ? senderId : receiverId);
        var second = lock(senderFirst ? receiverId : senderId);
        var sender = senderFirst ? first : second;
        var receiver = senderFirst ? second : first;
        // Both locks are held until commit, including while reading/replaying the sender-scoped key.
        var previous = transactions.findBySenderWalletIdAndTypeAndIdempotencyKey(senderId, TransactionType.TRANSFER, key);
        if (previous.isPresent()) {
            var transaction = previous.get();
            if (!receiverId.equals(transaction.getReceiverWalletId()) || amount.compareTo(transaction.getAmount()) != 0
                    || !Objects.equals(request.description(), transaction.getDescription())) {
                throw new FinancialException(HttpStatus.CONFLICT, "IDEMPOTENCY_CONFLICT",
                        "This idempotency key was already used with a different transfer payload.");
            }
            return TransferResponse.from(transaction);
        }
        sender.transferTo(receiver, amount.setScale(2));
        wallets.flush();
        var transaction = FinancialTransaction.transfer(senderId, receiverId, amount.setScale(2), request.description(), key);
        transactions.saveAndFlush(transaction);
        return TransferResponse.from(transaction);
    }

    private Wallet lock(UUID id) {
        return wallets.findByIdForUpdate(id).orElseThrow(() ->
                new FinancialException(HttpStatus.NOT_FOUND, "WALLET_NOT_FOUND", "Wallet not found."));
    }
}
