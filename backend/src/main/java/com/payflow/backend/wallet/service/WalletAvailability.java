package com.payflow.backend.wallet.service;

import com.payflow.backend.common.exception.FinancialException;
import com.payflow.backend.user.entity.UserStatus;
import com.payflow.backend.wallet.entity.Wallet;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class WalletAvailability {

    private final EntityManager entities;

    // Call only while holding all participating wallet locks. Suspension holds
    // the same owner's wallet lock, so status cannot change until commit.
    public void requireActive(Wallet... wallets) {
        for (Wallet wallet : wallets) {
            entities.refresh(wallet.getUser());
            if (wallet.getUser().getStatus() != UserStatus.ACTIVE) {
                throw new FinancialException(HttpStatus.CONFLICT, "ACCOUNT_UNAVAILABLE",
                        "A participant account is unavailable.");
            }
        }
    }

}
