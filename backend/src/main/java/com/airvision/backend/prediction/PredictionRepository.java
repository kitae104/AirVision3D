package com.airvision.backend.prediction;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PredictionRepository extends JpaRepository<Prediction, Long> {

    Page<Prediction> findAllByOrderByPredictedAtDesc(Pageable pageable);

    Page<Prediction> findBySite_IdOrderByPredictedAtDesc(Long siteId, Pageable pageable);
}
