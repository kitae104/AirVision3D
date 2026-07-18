package com.airvision.backend.publicdata.history;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;

/** 누적된 AirKorea 실측 1건 (조회 결과 매핑용). upsert는 리포지토리 네이티브 쿼리로 수행한다. */
@Entity
@Table(name = "public_air_measurement")
public class PublicAirMeasurement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "station_name", nullable = false, length = 100)
    private String stationName;

    private String sido;
    private Double latitude;
    private Double longitude;

    @Column(name = "measured_at", nullable = false)
    private Instant measuredAt;

    private Double pm10;
    private Double pm25;
    private Double o3;
    private Double no2;
    private Double co;
    private Double so2;
    private Double khai;

    @Column(name = "pm10_grade", length = 10)
    private String pm10Grade;

    @Column(name = "pm25_grade", length = 10)
    private String pm25Grade;

    @Column(name = "collected_mock", nullable = false)
    private boolean collectedMock;

    @Column(name = "collected_at", nullable = false)
    private Instant collectedAt;

    protected PublicAirMeasurement() {
    }

    @PrePersist
    void onCreate() {
        if (collectedAt == null) {
            collectedAt = Instant.now();
        }
    }

    public Long getId() {
        return id;
    }

    public String getStationName() {
        return stationName;
    }

    public String getSido() {
        return sido;
    }

    public Double getLatitude() {
        return latitude;
    }

    public Double getLongitude() {
        return longitude;
    }

    public Instant getMeasuredAt() {
        return measuredAt;
    }

    public Double getPm10() {
        return pm10;
    }

    public Double getPm25() {
        return pm25;
    }

    public Double getO3() {
        return o3;
    }

    public Double getNo2() {
        return no2;
    }

    public Double getCo() {
        return co;
    }

    public Double getSo2() {
        return so2;
    }

    public Double getKhai() {
        return khai;
    }

    public String getPm10Grade() {
        return pm10Grade;
    }

    public String getPm25Grade() {
        return pm25Grade;
    }

    public boolean isCollectedMock() {
        return collectedMock;
    }

    public Instant getCollectedAt() {
        return collectedAt;
    }
}
