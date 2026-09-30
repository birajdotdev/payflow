package com.payflow.backend.auth;

import java.util.Optional;
import java.util.UUID;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LoginSessionRepository extends JpaRepository<LoginSession, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from LoginSession s where s.id = :id")
    Optional<LoginSession> findLocked(@Param("id") UUID id);

}
