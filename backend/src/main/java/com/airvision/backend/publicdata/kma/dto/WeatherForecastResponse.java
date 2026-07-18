package com.airvision.backend.publicdata.kma.dto;

import java.time.Instant;
import java.util.List;

/** 초단기예보(6시간) 기반 기상 예보 (정규화 응답, 출처: 기상청). */
public record WeatherForecastResponse(
        double latitude,
        double longitude,
        Instant baseTime,
        String source,
        boolean mock,
        List<Hour> hours
) {

    public record Hour(
            Instant forecastAt,
            Double temperature,
            Double humidity,
            String sky,
            String precipitationType,
            Double windSpeed,
            Double windDirectionDegree,
            String windDirectionText
    ) {
    }
}
