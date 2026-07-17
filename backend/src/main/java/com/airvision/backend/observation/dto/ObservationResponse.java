package com.airvision.backend.observation.dto;

import com.airvision.backend.observation.Observation;
import java.time.Instant;

/** 관측값 응답. */
public record ObservationResponse(
        Long id,
        Long siteId,
        String siteName,
        Instant observedAt,
        Double pm10,
        Double pm25,
        Double temperature,
        Double humidity,
        Double windSpeed,
        Double windDirection,
        Instant createdAt
) {

    public static ObservationResponse from(Observation o) {
        return new ObservationResponse(
                o.getId(),
                o.getSite().getId(),
                o.getSite().getName(),
                o.getObservedAt(),
                o.getPm10(),
                o.getPm25(),
                o.getTemperature(),
                o.getHumidity(),
                o.getWindSpeed(),
                o.getWindDirection(),
                o.getCreatedAt()
        );
    }
}
