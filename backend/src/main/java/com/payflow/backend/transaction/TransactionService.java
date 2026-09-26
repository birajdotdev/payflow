package com.payflow.backend.transaction;

import com.payflow.backend.auth.CurrentUserService;
import com.payflow.backend.common.exception.FinancialException;
import com.payflow.backend.wallet.WalletRepository;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TransactionService {
    private final CurrentUserService currentUserService;
    private final WalletRepository wallets;
    private final TransactionRepository transactions;

    public TransactionPage history(TransactionType type, TransactionStatus status,
                                   Instant fromDate, Instant toDate, int page, int size) {
        UUID walletId = currentWalletId();
        if (page < 0 || size < 1 || size > 100 || (long) page * size > Integer.MAX_VALUE
                || (fromDate != null && toDate != null && !fromDate.isBefore(toDate))) {
            throw new FinancialException(HttpStatus.BAD_REQUEST, "INVALID_REQUEST",
                    "Page must be nonnegative with a supported offset, size must be 1 to 100, and fromDate must precede toDate.");
        }
        var results = transactions.findAll((root, query, builder) -> {
            var predicates = new ArrayList<Predicate>();
            // Ownership is part of the SQL predicate, including the pagination count query.
            predicates.add(builder.or(builder.equal(root.get("senderWalletId"), walletId),
                    builder.equal(root.get("receiverWalletId"), walletId)));
            if (type != null) predicates.add(builder.equal(root.get("type"), type));
            if (status != null) predicates.add(builder.equal(root.get("status"), status));
            if (fromDate != null) predicates.add(builder.greaterThanOrEqualTo(root.get("createdAt"), fromDate));
            if (toDate != null) predicates.add(builder.lessThan(root.get("createdAt"), toDate));
            return builder.and(predicates.toArray(Predicate[]::new));
        }, PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt", "id")));
        return TransactionPage.from(results);
    }

    public TransactionResponse detail(UUID id) {
        return transactions.findVisibleById(id, currentWalletId()).map(TransactionResponse::from)
                .orElseThrow(() -> new FinancialException(HttpStatus.NOT_FOUND,
                        "TRANSACTION_NOT_FOUND", "Transaction not found."));
    }

    private UUID currentWalletId() {
        return wallets.findIdByUserId(currentUserService.requireCurrentUser().getId())
                .orElseThrow(() -> new IllegalStateException("Primary wallet is missing."));
    }
}
