package com.airvision.backend.prediction;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PredictionRepository extends JpaRepository<Prediction, Long> {

    Page<Prediction> findAllByOrderByPredictedAtDesc(Pageable pageable);

    Page<Prediction> findBySite_IdOrderByPredictedAtDesc(Long siteId, Pageable pageable);

    Page<Prediction> findBySite_DistrictOrderByPredictedAtDesc(String district, Pageable pageable);

    long countByPredictedAtAfter(java.time.Instant time);

    /** 구 소속 관측소의 최근 예측 건수 (대시보드 구 단위 필터용). */
    long countByPredictedAtAfterAndSite_District(java.time.Instant time, String district);

    /** 실측값이 기록된 예측 전체 (모델 정확도 리포트용, 최신순). */
    @org.springframework.data.jpa.repository.Query("""
            SELECT p FROM Prediction p
            JOIN FETCH p.model
            JOIN FETCH p.site
            WHERE p.actualPm25 IS NOT NULL
            ORDER BY p.predictedAt DESC
            """)
    java.util.List<Prediction> findAllWithActual();

    /** 관측소별 최신 예측 (3D 지도 예측 레이어용). */
    interface LatestPrediction {
        Long getSiteId();

        String getSiteName();

        Double getLatitude();

        Double getLongitude();

        Double getPm25();

        String getGrade();

        java.time.Instant getPredictedAt();
    }

    @org.springframework.data.jpa.repository.Query(value = """
            SELECT DISTINCT ON (p.site_id)
                   p.site_id         AS siteId,
                   s.name            AS siteName,
                   s.latitude        AS latitude,
                   s.longitude       AS longitude,
                   p.predicted_pm25  AS pm25,
                   p.predicted_grade AS grade,
                   p.predicted_at    AS predictedAt
            FROM predictions p
            JOIN observation_sites s ON s.id = p.site_id
            ORDER BY p.site_id, p.predicted_at DESC
            """, nativeQuery = true)
    java.util.List<LatestPrediction> findLatestPerSite();
}
