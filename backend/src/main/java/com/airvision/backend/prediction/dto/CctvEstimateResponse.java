package com.airvision.backend.prediction.dto;

import java.time.Instant;

/**
 * CCTV 이미지 기반 미세먼지 추정 결과.
 * mode=AI_IMAGE: 이미지 AI 추론 (PM10은 최근접 실측 비율 추정, 없으면 null).
 * mode=STATION_FALLBACK: 야간(태양고도 임계 미만) — 최근접 AirKorea 실측 대체.
 * visibilityKm는 Koschmieder 간이식 기반 추정(간이 지표)이다.
 */
public record CctvEstimateResponse(
        Long siteId,
        String modelName,
        String mode,
        boolean night,
        double solarElevationDeg,
        Double pm25,
        Double pm10,
        String grade,
        Double visibilityKm,
        String stationName,
        Instant estimatedAt) {
}
