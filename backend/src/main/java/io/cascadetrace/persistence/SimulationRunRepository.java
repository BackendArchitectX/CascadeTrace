package io.cascadetrace.persistence;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface SimulationRunRepository extends JpaRepository<SimulationRunEntity, UUID> {
    Optional<SimulationRunEntity> findFirstByFingerprintAndRecordedAtAfterOrderByRecordedAtDesc(String fingerprint, Instant recordedAt);

    Page<SimulationRunEntity> findAllByOrderByRecordedAtDesc(Pageable pageable);

    @Query("select distinct r from SimulationRunEntity r left join fetch r.commands where r.id = :id")
    Optional<SimulationRunEntity> findDetailById(@Param("id") UUID id);
}
