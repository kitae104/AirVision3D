package com.airvision.backend.observation;

import com.airvision.backend.site.ObservationSite;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;

/** 관측값 엔티티 (센서 측정치). (site, observed_at) 조합은 유일하다. */
@Entity
@Table(name = "observations",
        uniqueConstraints = @UniqueConstraint(name = "uq_observations_site_time",
                columnNames = {"site_id", "observed_at"}))
public class Observation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "site_id", nullable = false)
    private ObservationSite site;

    @Column(name = "observed_at", nullable = false)
    private Instant observedAt;

    private Double pm10;

    private Double pm25;

    private Double temperature;

    private Double humidity;

    @Column(name = "wind_speed")
    private Double windSpeed;

    @Column(name = "wind_direction")
    private Double windDirection;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected Observation() {
    }

    public Observation(ObservationSite site, Instant observedAt, Double pm10, Double pm25,
                       Double temperature, Double humidity, Double windSpeed, Double windDirection) {
        this.site = site;
        this.observedAt = observedAt;
        this.pm10 = pm10;
        this.pm25 = pm25;
        this.temperature = temperature;
        this.humidity = humidity;
        this.windSpeed = windSpeed;
        this.windDirection = windDirection;
    }

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }

    public void update(Instant observedAt, Double pm10, Double pm25,
                       Double temperature, Double humidity, Double windSpeed, Double windDirection) {
        this.observedAt = observedAt;
        this.pm10 = pm10;
        this.pm25 = pm25;
        this.temperature = temperature;
        this.humidity = humidity;
        this.windSpeed = windSpeed;
        this.windDirection = windDirection;
    }

    public Long getId() {
        return id;
    }

    public ObservationSite getSite() {
        return site;
    }

    public Instant getObservedAt() {
        return observedAt;
    }

    public Double getPm10() {
        return pm10;
    }

    public Double getPm25() {
        return pm25;
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

    public Double getWindDirection() {
        return windDirection;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
