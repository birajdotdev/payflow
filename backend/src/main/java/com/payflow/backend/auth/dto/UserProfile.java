package com.payflow.backend.auth.dto;

import com.payflow.backend.user.User;
import com.payflow.backend.user.UserRole;
import com.payflow.backend.user.UserStatus;

import java.util.UUID;

public record UserProfile(UUID userId, String fullName, String email, String phone,
                          UserRole role, UserStatus status) {
    public static UserProfile from(User user) {
        return new UserProfile(user.getId(), user.getFullName(), user.getEmail(), user.getPhone(),
                user.getRole(), user.getStatus());
    }
}
