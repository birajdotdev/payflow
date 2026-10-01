package com.payflow.backend.admin.service;

import java.time.Instant;
import java.util.UUID;

import com.payflow.backend.admin.dto.*;
import com.payflow.backend.admin.entity.StatusAudit;
import com.payflow.backend.admin.repository.StatusAuditRepository;
import com.payflow.backend.auth.repository.LoginSessionRepository;
import com.payflow.backend.auth.service.CurrentUserService;
import com.payflow.backend.common.exception.FinancialException;
import com.payflow.backend.merchant.service.MerchantService;
import com.payflow.backend.user.entity.*;
import com.payflow.backend.user.repository.UserRepository;
import com.payflow.backend.wallet.entity.*;
import com.payflow.backend.wallet.repository.WalletRepository;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminService {

    private final CurrentUserService currentUser;

    private final UserRepository users;

    private final WalletRepository wallets;

    private final LoginSessionRepository sessions;

    private final StatusAuditRepository audits;

    private final EntityManager entities;

    public record AccountDetail(AccountResponse account, AdminWalletResponse wallet, AdminPage<StatusAudit> audits) {
    }

    public record WalletDetail(AdminWalletResponse wallet, AccountResponse account, AdminPage<StatusAudit> audits) {
    }

    private User requireAdmin() {
        var actor = currentUser.requireCurrentUser();
        entities.refresh(actor);
        if (actor.getRole() != UserRole.ADMIN || actor.getStatus() != UserStatus.ACTIVE)
            throw new FinancialException(HttpStatus.FORBIDDEN, "FORBIDDEN", "An active administrator is required.");
        return actor;
    }

    public AdminPage<AccountResponse> accounts(int page, int size) {
        requireAdmin();
        return AdminPage.from(users.findAll(MerchantService.pageRequest(page, size))
            .map(u -> AccountResponse.from(u, wallets.findIdByUserId(u.getId()).orElseThrow())));
    }

    public AdminPage<AdminWalletResponse> wallets(int page, int size) {
        requireAdmin();
        return AdminPage.from(wallets.findAll(MerchantService.pageRequest(page, size)).map(AdminWalletResponse::from));
    }

    public AccountDetail account(UUID id, int page, int size) {
        requireAdmin();
        var user = users.findById(id).orElseThrow(AdminService::missing);
        var wallet = wallets.findByUser_Id(id).orElseThrow(AdminService::missing);
        return new AccountDetail(AccountResponse.from(user, wallet.getId()), AdminWalletResponse.from(wallet),
                history("ACCOUNT", id, page, size));
    }

    public WalletDetail wallet(UUID id, int page, int size) {
        requireAdmin();
        var wallet = wallets.findById(id).orElseThrow(AdminService::missing);
        return new WalletDetail(AdminWalletResponse.from(wallet), AccountResponse.from(wallet.getUser(), id),
                history("WALLET", id, page, size));
    }

    private AdminPage<StatusAudit> history(String resource, UUID id, int page, int size) {
        return AdminPage
            .from(audits.findByResourceTypeAndTargetId(resource, id, MerchantService.pageRequest(page, size)));
    }

    private void serializeAdministration() {
        // Across application instances; released automatically on commit/rollback.
        entities.createNativeQuery("select pg_advisory_xact_lock(72419001)").getSingleResult();
    }

    @Transactional
    public AccountResponse accountStatus(UUID id, StatusRequest input) {
        validate(input);
        UserStatus next;
        try {
            next = UserStatus.valueOf(input.status());
        }
        catch (IllegalArgumentException e) {
            throw invalid();
        }

        serializeAdministration();
        var actor = requireAdmin();
        var wallet = wallets.findByUserIdForUpdate(id).orElseThrow(AdminService::missing);
        var target = users.findByIdForUpdate(id).orElseThrow(AdminService::missing);
        entities.refresh(target);

        if (next == UserStatus.SUSPENDED && actor.getId().equals(id))
            throw new FinancialException(HttpStatus.CONFLICT, "SELF_SUSPENSION",
                    "You cannot suspend your own account.");
        if (target.getStatus() == next)
            return AccountResponse.from(target, wallet.getId());
        if (next == UserStatus.SUSPENDED && target.getRole() == UserRole.ADMIN
                && users.countByRoleAndStatus(UserRole.ADMIN, UserStatus.ACTIVE) <= 1)
            throw new FinancialException(HttpStatus.CONFLICT, "LAST_ACTIVE_ADMIN",
                    "The last active administrator cannot be suspended.");

        var previous = target.getStatus().name();
        target.setStatus(next);
        if (next == UserStatus.SUSPENDED)
            sessions.revokeAll(id, Instant.now());
        users.flush();
        audits
            .saveAndFlush(new StatusAudit(actor.getId(), "ACCOUNT", id, previous, next.name(), input.reason().trim()));
        return AccountResponse.from(target, wallet.getId());
    }

    @Transactional
    public AdminWalletResponse walletStatus(UUID id, StatusRequest input) {
        validate(input);
        WalletStatus next;
        try {
            next = WalletStatus.valueOf(input.status());
        }
        catch (IllegalArgumentException e) {
            throw invalid();
        }

        serializeAdministration();
        var actor = requireAdmin();
        var target = wallets.findByIdForUpdate(id).orElseThrow(AdminService::missing);
        if (target.getStatus() == next)
            return AdminWalletResponse.from(target);

        var previous = target.getStatus().name();
        target.setStatus(next);
        wallets.flush();
        audits.saveAndFlush(new StatusAudit(actor.getId(), "WALLET", id, previous, next.name(), input.reason().trim()));
        return AdminWalletResponse.from(target);
    }

    private static void validate(StatusRequest input) {
        if (input == null || input.status() == null || input.reason() == null || input.reason().isBlank()
                || input.reason().length() > 500)
            throw invalid();
    }

    private static FinancialException invalid() {
        return new FinancialException(HttpStatus.BAD_REQUEST, "INVALID_REQUEST",
                "A valid status and reason (1 to 500 characters) are required.");
    }

    private static FinancialException missing() {
        return new FinancialException(HttpStatus.NOT_FOUND, "ADMIN_TARGET_NOT_FOUND", "Account or wallet not found.");
    }

}
