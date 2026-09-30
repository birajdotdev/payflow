package com.payflow.backend.auth;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.*;
public interface LoginSessionRepository extends JpaRepository<LoginSession, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from LoginSession s where s.id = :id")
    Optional<LoginSession> findLocked(@Param("id") UUID id);
}
