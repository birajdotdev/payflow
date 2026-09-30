package com.payflow.backend.wallet.service;

import com.payflow.backend.auth.service.CurrentUserService;
import com.payflow.backend.wallet.dto.WalletResponse;
import com.payflow.backend.wallet.repository.WalletRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class WalletService {

    private final CurrentUserService currentUserService;

    private final WalletRepository wallets;

    @Transactional(readOnly = true)
    public WalletResponse currentWallet() {
        var owner = currentUserService.requireCurrentUser();
        // No caller-supplied owner or wallet ID can influence this lookup.
        return wallets.findByUser_Id(owner.getId())
            .map(WalletResponse::from)
            .orElseThrow(() -> new IllegalStateException("Primary wallet is missing."));
    }

}
