package com.airvision.backend.publicdata.history;

import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface PublicWeatherObservationRepository
        extends JpaRepository<PublicWeatherObservation, Long> {

    @Modifying
    @Transactional
    @Query(value = """
            INSERT INTO public_weather_observation
              (sido, grid_x, grid_y, latitude, longitude, base_time,
               temperature, humidity, wind_speed, wind_direction_deg,
               precipitation_type, collected_mock, collected_at)
            VALUES (:sido, :gridX, :gridY, :latitude, :longitude, :baseTime,
               :temperature, :humidity, :windSpeed, :windDirectionDeg,
               :precipitationType, :mock, :collectedAt)
            ON CONFLICT (grid_x, grid_y, base_time) DO UPDATE SET
               temperature = EXCLUDED.temperature, humidity = EXCLUDED.humidity,
               wind_speed = EXCLUDED.wind_speed, wind_direction_deg = EXCLUDED.wind_direction_deg,
               precipitation_type = EXCLUDED.precipitation_type,
               collected_mock = EXCLUDED.collected_mock, collected_at = EXCLUDED.collected_at
            """, nativeQuery = true)
    int upsert(@Param("sido") String sido, @Param("gridX") int gridX, @Param("gridY") int gridY,
               @Param("latitude") Double latitude, @Param("longitude") Double longitude,
               @Param("baseTime") Instant baseTime, @Param("temperature") Double temperature,
               @Param("humidity") Double humidity, @Param("windSpeed") Double windSpeed,
               @Param("windDirectionDeg") Double windDirectionDeg,
               @Param("precipitationType") String precipitationType,
               @Param("mock") boolean mock, @Param("collectedAt") Instant collectedAt);

    List<PublicWeatherObservation> findBySidoAndBaseTimeBetweenOrderByBaseTime(
            String sido, Instant from, Instant to);

    @Modifying
    @Transactional
    void deleteByBaseTimeBefore(Instant cutoff);
}
