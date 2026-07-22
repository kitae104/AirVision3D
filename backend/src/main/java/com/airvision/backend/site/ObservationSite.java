package com.airvision.backend.site;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * 관측소 엔티티.
 * geom 컬럼은 DB에서 latitude/longitude로부터 자동 생성되므로 매핑하지 않는다.
 */
@Entity
@Table(name = "observation_sites")
public class ObservationSite {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    private String name;

    @Column(nullable = false)
    private double latitude;

    @Column(nullable = false)
    private double longitude;

    private Double altitude;

    @Column(name = "site_type", nullable = false, length = 30)
    private String siteType = "SENSOR";

    @Column(columnDefinition = "text")
    private String description;

    /** 소속 행정구 (인천 핵심 3구만 값 존재, 그 외 NULL). 시드/마이그레이션으로만 채운다. */
    @Column(length = 30)
    private String district;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ObservationSite() {
    }

    public ObservationSite(String name, double latitude, double longitude,
                           Double altitude, String siteType, String description) {
        this.name = name;
        this.latitude = latitude;
        this.longitude = longitude;
        this.altitude = altitude;
        this.siteType = siteType != null ? siteType : "SENSOR";
        this.description = description;
    }

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public void update(String name, double latitude, double longitude,
                       Double altitude, String siteType, String description) {
        this.name = name;
        this.latitude = latitude;
        this.longitude = longitude;
        this.altitude = altitude;
        this.siteType = siteType != null ? siteType : this.siteType;
        this.description = description;
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public double getLatitude() {
        return latitude;
    }

    public double getLongitude() {
        return longitude;
    }

    public Double getAltitude() {
        return altitude;
    }

    public String getSiteType() {
        return siteType;
    }

    public String getDescription() {
        return description;
    }

    public String getDistrict() {
        return district;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
