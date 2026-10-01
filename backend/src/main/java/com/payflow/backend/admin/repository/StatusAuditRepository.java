package com.payflow.backend.admin.repository;

import java.util.UUID;

import com.payflow.backend.admin.entity.StatusAudit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface StatusAuditRepository extends JpaRepository<StatusAudit, UUID> {

    Page<StatusAudit> findByResourceTypeAndTargetId(String resourceType, UUID targetId, Pageable pageable);

}
