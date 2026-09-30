package com.payflow.backend.payment.dto;

import java.util.List;

public record PaymentRequestPage(List<PaymentRequestResponse> content, int page, int size, long totalElements,
        int totalPages, boolean hasNext) {
}
