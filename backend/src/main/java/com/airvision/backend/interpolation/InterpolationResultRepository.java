package com.airvision.backend.interpolation;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InterpolationResultRepository extends JpaRepository<InterpolationResult, Long> {

    Page<InterpolationResult> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
