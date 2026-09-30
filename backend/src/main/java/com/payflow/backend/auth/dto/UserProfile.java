package com.payflow.backend.auth.dto;

import java.util.UUID;

import com.payflow.backend.user.entity.User;
import com.payflow.backend.user.entity.UserRole;
import com.payflow.backend.user.entity.UserStatus;

public record UserProfile(UUID userId, String fullName, String email, String phone, UserRole role, UserStatus status) {
    public static UserProfile from(User user) {
        return new UserProfile(user.getId(), user.getFullName(), user.getEmail(), user.getPhone(), user.getRole(),
                user.getStatus());
    }
}
