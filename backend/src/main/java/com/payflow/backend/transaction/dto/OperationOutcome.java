package com.payflow.backend.transaction.dto;

public record OperationOutcome(String state, TransactionResponse transaction) {
}
