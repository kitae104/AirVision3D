package com.airvision.backend.publicdata.kma.dto;

import java.time.Instant;

/**
 * 초단기실황 기반 현재 기상 (정규화 응답, 출처: 기상청).
 * windDirectionDegree는 기상학적 풍향(불어오는 방향),
 * windArrowDegree는 지도 화살표용 이동 방향(180도 반전)이다.
 */
public record WeatherNowResponse(
        double latitude,
        double longitude,
        int gridX,
        int gridY,
        Instant baseTime,
        String source,
        boolean mock,
        boolean stale,
        Double temperature,
        Double humidity,
        Double precipitationMm,
        String precipitationType,
        Double windSpeed,
        Double windDirectionDegree,
        String windDirectionText,
        Double windArrowDegree
) {
}
