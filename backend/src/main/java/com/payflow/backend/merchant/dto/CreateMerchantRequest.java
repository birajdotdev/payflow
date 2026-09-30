package com.payflow.backend.merchant.dto;

import jakarta.validation.constraints.*;

public record CreateMerchantRequest(@NotBlank @Size(max = 100) String businessName,
        @NotBlank @Email @Size(max = 255) String contactEmail,
        @NotBlank @Pattern(regexp = "\\+?[0-9]{7,15}") String contactNumber) {
}
