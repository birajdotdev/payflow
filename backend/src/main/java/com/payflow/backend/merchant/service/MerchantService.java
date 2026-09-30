package com.payflow.backend.merchant.service;

import java.util.UUID;

import com.payflow.backend.auth.service.CurrentUserService;
import com.payflow.backend.common.exception.FinancialException;
import com.payflow.backend.merchant.dto.*;
import com.payflow.backend.merchant.entity.Merchant;
import com.payflow.backend.merchant.repository.MerchantRepository;
import com.payflow.backend.transaction.dto.TransactionPage;
import com.payflow.backend.transaction.entity.TransactionType;
import com.payflow.backend.transaction.repository.TransactionRepository;
import com.payflow.backend.user.entity.UserRole;
import com.payflow.backend.wallet.repository.WalletRepository;
import com.payflow.backend.wallet.service.WalletAvailability;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MerchantService {

    private final CurrentUserService currentUser;

    private final MerchantRepository merchants;

    private final WalletRepository wallets;

    private final WalletAvailability availability;

    private final TransactionRepository transactions;

    @Transactional
    public MerchantResponse create(CreateMerchantRequest request) {
        var owner = currentUser.requireCurrentUser();

        if (owner.getRole() != UserRole.USER && owner.getRole() != UserRole.MERCHANT)
            throw new FinancialException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Merchant enrollment is unavailable.");

        // Serialize enrollment for this account, including concurrent profile creation.
        var wallet = wallets.findByUserIdForUpdate(owner.getId()).orElseThrow();
        availability.requireActive(wallet);

        var existing = merchants.findByUserId(owner.getId());

        if (existing.isPresent()) {
            var m = existing.get();

            if (!m.getBusinessName().equals(request.businessName().trim())
                    || !m.getContactEmail().equals(request.contactEmail().trim())
                    || !m.getContactNumber().equals(request.contactNumber()))
                throw new FinancialException(HttpStatus.CONFLICT, "MERCHANT_EXISTS",
                        "A merchant profile already exists.");

            return MerchantResponse.from(m);
        }

        var m = merchants.saveAndFlush(new Merchant(owner.getId(), wallet.getId(), request.businessName().trim(),
                request.contactEmail().trim(), request.contactNumber()));
        owner.becomeMerchant();

        return MerchantResponse.from(m);
    }

    public MerchantResponse me() {
        return MerchantResponse.from(merchants.findByUserId(currentUser.requireCurrentUser().getId())
            .orElseThrow(() -> new FinancialException(HttpStatus.NOT_FOUND, "MERCHANT_NOT_FOUND",
                    "Merchant profile not found.")));
    }

    public MerchantResponse profile(UUID id) {
        currentUser.requireCurrentUser();

        return MerchantResponse.from(find(id));
    }

    public Merchant find(UUID id) {
        return merchants.findById(id)
            .orElseThrow(() -> new FinancialException(HttpStatus.NOT_FOUND, "MERCHANT_NOT_FOUND",
                    "Merchant profile not found."));
    }

    public Merchant requireOwned() {
        var user = currentUser.requireCurrentUser();

        if (user.getRole() != UserRole.MERCHANT)
            throw new FinancialException(HttpStatus.FORBIDDEN, "FORBIDDEN", "A merchant account is required.");

        return merchants.findByUserId(user.getId())
            .orElseThrow(() -> new FinancialException(HttpStatus.NOT_FOUND, "MERCHANT_NOT_FOUND",
                    "Merchant profile not found."));
    }

    public TransactionPage payments(int page, int size) {
        var m = requireOwned();

        return TransactionPage.from(transactions.findByReceiverWalletIdAndType(m.getWalletId(),
                TransactionType.MERCHANT_PAYMENT, pageRequest(page, size)));
    }

    public static PageRequest pageRequest(int page, int size) {
        if (page < 0 || size < 1 || size > 100 || (long) page * size > Integer.MAX_VALUE)
            throw new FinancialException(HttpStatus.BAD_REQUEST, "INVALID_REQUEST",
                    "Use a nonnegative page and size 1 to 100.");

        return PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt", "id"));
    }

}
