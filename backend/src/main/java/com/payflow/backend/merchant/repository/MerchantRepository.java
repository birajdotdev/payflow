package com.payflow.backend.merchant.repository;

import java.util.Optional;
import java.util.UUID;

import com.payflow.backend.merchant.entity.Merchant;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MerchantRepository extends JpaRepository<Merchant, UUID> {

    Optional<Merchant> findByUserId(UUID userId);

}
