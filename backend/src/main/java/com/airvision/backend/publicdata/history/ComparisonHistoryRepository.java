package com.airvision.backend.publicdata.history;

import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface ComparisonHistoryRepository extends JpaRepository<ComparisonHistory, Long> {

    @Modifying
    @Transactional
    @Query(value = """
            INSERT INTO comparison_history
              (site_id, site_name, predicted_at, predicted_pm25, station_name,
               measured_at, measured_pm25, distance_km, time_diff_minutes,
               absolute_error, error_rate_percent, matched, computed_at)
            VALUES (:siteId, :siteName, :predictedAt, :predictedPm25, :stationName,
               :measuredAt, :measuredPm25, :distanceKm, :timeDiffMinutes,
               :absoluteError, :errorRatePercent, TRUE, :computedAt)
            ON CONFLICT (site_id, predicted_at, station_name, measured_at) DO NOTHING
            """, nativeQuery = true)
    int insertSnapshot(@Param("siteId") Long siteId, @Param("siteName") String siteName,
                       @Param("predictedAt") Instant predictedAt,
                       @Param("predictedPm25") double predictedPm25,
                       @Param("stationName") String stationName,
                       @Param("measuredAt") Instant measuredAt,
                       @Param("measuredPm25") Double measuredPm25,
                       @Param("distanceKm") Double distanceKm,
                       @Param("timeDiffMinutes") Long timeDiffMinutes,
                       @Param("absoluteError") Double absoluteError,
                       @Param("errorRatePercent") Double errorRatePercent,
                       @Param("computedAt") Instant computedAt);

    List<ComparisonHistory> findByComputedAtBetweenOrderByComputedAt(Instant from, Instant to);
}
