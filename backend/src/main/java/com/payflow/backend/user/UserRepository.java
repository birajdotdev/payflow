package com.payflow.backend.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmail(String email);

    @Query("select u from User u where lower(trim(u.email)) = :email")
    Optional<User> findByNormalizedEmail(@Param("email") String email);

    boolean existsByEmail(String email);

    boolean existsByPhone(String phone);
}
