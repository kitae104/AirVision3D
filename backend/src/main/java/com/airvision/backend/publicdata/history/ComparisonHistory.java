package com.airvision.backend.publicdata.history;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;

/** AI 추정-실측 비교 스냅샷 1건 (matched 결과만 저장). */
@Entity
@Table(name = "comparison_history")
public class ComparisonHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "site_id")
    private Long siteId;

    @Column(name = "site_name", length = 100)
    private String siteName;

    @Column(name = "predicted_at", nullable = false)
    private Instant predictedAt;

    @Column(name = "predicted_pm25", nullable = false)
    private double predictedPm25;

    @Column(name = "station_name", length = 100)
    private String stationName;

    @Column(name = "measured_at")
    private Instant measuredAt;

    @Column(name = "measured_pm25")
    private Double measuredPm25;

    @Column(name = "distance_km")
    private Double distanceKm;

    @Column(name = "time_diff_minutes")
    private Long timeDiffMinutes;

    @Column(name = "absolute_error")
    private Double absoluteError;

    @Column(name = "error_rate_percent")
    private Double errorRatePercent;

    @Column(nullable = false)
    private boolean matched;

    @Column(name = "computed_at", nullable = false)
    private Instant computedAt;

    protected ComparisonHistory() {
    }

    @PrePersist
    void onCreate() {
        if (computedAt == null) {
            computedAt = Instant.now();
        }
    }

    public Long getId() {
        return id;
    }

    public Long getSiteId() {
        return siteId;
    }

    public String getSiteName() {
        return siteName;
    }

    public Instant getPredictedAt() {
        return predictedAt;
    }

    public double getPredictedPm25() {
        return predictedPm25;
    }

    public String getStationName() {
        return stationName;
    }

    public Instant getMeasuredAt() {
        return measuredAt;
    }

    public Double getMeasuredPm25() {
        return measuredPm25;
    }

    public Double getDistanceKm() {
        return distanceKm;
    }

    public Long getTimeDiffMinutes() {
        return timeDiffMinutes;
    }

    public Double getAbsoluteError() {
        return absoluteError;
    }

    public Double getErrorRatePercent() {
        return errorRatePercent;
    }

    public boolean isMatched() {
        return matched;
    }

    public Instant getComputedAt() {
        return computedAt;
    }
}
