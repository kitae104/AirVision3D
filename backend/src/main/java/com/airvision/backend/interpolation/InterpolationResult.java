package com.airvision.backend.interpolation;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;

/** IDW 보간 결과 엔티티. geom 컬럼은 DB에서 자동 생성되므로 매핑하지 않는다. */
@Entity
@Table(name = "interpolation_results")
public class InterpolationResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "target_name", length = 100)
    private String targetName;

    @Column(nullable = false)
    private double latitude;

    @Column(nullable = false)
    private double longitude;

    @Column(name = "interpolated_at", nullable = false)
    private Instant interpolatedAt;

    @Column(name = "source_type", nullable = false, length = 30)
    private String sourceType = "OBSERVATION";

    @Column(nullable = false, length = 30)
    private String algorithm = "IDW";

    @Column(nullable = false)
    private double power;

    @Column(nullable = false)
    private double pm25;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected InterpolationResult() {
    }

    public InterpolationResult(String targetName, double latitude, double longitude,
                               Instant interpolatedAt, String sourceType, String algorithm,
                               double power, double pm25) {
        this.targetName = targetName;
        this.latitude = latitude;
        this.longitude = longitude;
        this.interpolatedAt = interpolatedAt;
        this.sourceType = sourceType;
        this.algorithm = algorithm;
        this.power = power;
        this.pm25 = pm25;
    }

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public String getTargetName() {
        return targetName;
    }

    public double getLatitude() {
        return latitude;
    }

    public double getLongitude() {
        return longitude;
    }

    public Instant getInterpolatedAt() {
        return interpolatedAt;
    }

    public String getSourceType() {
        return sourceType;
    }

    public String getAlgorithm() {
        return algorithm;
    }

    public double getPower() {
        return power;
    }

    public double getPm25() {
        return pm25;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
