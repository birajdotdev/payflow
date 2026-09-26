package com.payflow.backend.common.exception;

import com.payflow.backend.common.response.ApiError;
import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

import java.util.Set;

@RestControllerAdvice
public class ApiExceptionHandler extends ResponseEntityExceptionHandler {
    private static final Set<String> REGISTRATION_CONSTRAINTS = Set.of(
            "users_email_key", "users_email_normalized_key", "users_phone_key");

    @ExceptionHandler(jakarta.validation.ConstraintViolationException.class)
    ResponseEntity<ApiError> handleValidation(jakarta.validation.ConstraintViolationException exception) {
        return ResponseEntity.badRequest()
                .body(ApiError.of("INVALID_REQUEST", "The request could not be processed."));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ApiError> handleIntegrityViolation(DataIntegrityViolationException exception) {
        for (Throwable cause = exception; cause != null; cause = cause.getCause()) {
            if (cause instanceof ConstraintViolationException violation
                    && violation.getConstraintName() != null
                    && REGISTRATION_CONSTRAINTS.contains(violation.getConstraintName())) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                        .body(ApiError.of("REGISTRATION_CONFLICT", "Unable to register with the supplied details."));
            }
        }
        return handleUnexpected(exception);
    }

    @Override
    protected ResponseEntity<Object> handleExceptionInternal(Exception exception, Object body,
            HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        return new ResponseEntity<>(ApiError.of("INVALID_REQUEST", "The request could not be processed."),
                headers, status);
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiError> handleUnexpected(Exception exception) {
        // Do not log exception messages: database/validation errors can contain personal data.
        logger.error("Request failed: " + exception.getClass().getSimpleName());
        return ResponseEntity.internalServerError()
                .body(ApiError.of("INTERNAL_ERROR", "An unexpected error occurred."));
    }
}
