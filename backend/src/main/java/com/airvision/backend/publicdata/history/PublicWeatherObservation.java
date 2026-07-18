package com.airvision.backend.publicdata.history;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;

/** 누적된 기상청 초단기실황 1건. */
@Entity
@Table(name = "public_weather_observation")
public class PublicWeatherObservation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String sido;

    @Column(name = "grid_x", nullable = false)
    private int gridX;

    @Column(name = "grid_y", nullable = false)
    private int gridY;

    private Double latitude;
    private Double longitude;

    @Column(name = "base_time", nullable = false)
    private Instant baseTime;

    private Double temperature;
    private Double humidity;

    @Column(name = "wind_speed")
    private Double windSpeed;

    @Column(name = "wind_direction_deg")
    private Double windDirectionDeg;

    @Column(name = "precipitation_type", length = 20)
    private String precipitationType;

    @Column(name = "collected_mock", nullable = false)
    private boolean collectedMock;

    @Column(name = "collected_at", nullable = false)
    private Instant collectedAt;

    protected PublicWeatherObservation() {
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

    public String getSido() {
        return sido;
    }

    public int getGridX() {
        return gridX;
    }

    public int getGridY() {
        return gridY;
    }

    public Double getLatitude() {
        return latitude;
    }

    public Double getLongitude() {
        return longitude;
    }

    public Instant getBaseTime() {
        return baseTime;
    }

    public Double getTemperature() {
        return temperature;
    }

    public Double getHumidity() {
        return humidity;
    }

    public Double getWindSpeed() {
        return windSpeed;
    }

    public Double getWindDirectionDeg() {
        return windDirectionDeg;
    }

    public String getPrecipitationType() {
        return precipitationType;
    }

    public boolean isCollectedMock() {
        return collectedMock;
    }

    public Instant getCollectedAt() {
        return collectedAt;
    }
}
