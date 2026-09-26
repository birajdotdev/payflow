package com.payflow.backend.transaction;

import java.util.List;
import org.springframework.data.domain.Page;

public record TransactionPage(List<TransactionResponse> content, int page, int size,
                              long totalElements, int totalPages, boolean hasNext) {
    public static TransactionPage from(Page<FinancialTransaction> results) {
        return new TransactionPage(results.getContent().stream().map(TransactionResponse::from).toList(),
                results.getNumber(), results.getSize(), results.getTotalElements(), results.getTotalPages(),
                results.hasNext());
    }
}
