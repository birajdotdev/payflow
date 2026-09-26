package com.payflow.backend.auth.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

import java.nio.charset.StandardCharsets;

public class RegistrationPasswordValidator implements ConstraintValidator<RegistrationPassword, String> {
    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        return value != null && !value.isBlank()
                && value.codePointCount(0, value.length()) >= 8
                && value.getBytes(StandardCharsets.UTF_8).length <= 72;
    }
}
