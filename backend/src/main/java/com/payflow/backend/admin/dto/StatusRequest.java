package com.payflow.backend.admin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record StatusRequest(@NotBlank String status, @NotBlank @Size(max = 500) String reason) {
}
