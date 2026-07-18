package com.airvision.backend.publicdata.airkorea.dto;

import java.time.Instant;
import java.util.List;

/**
 * 시도 단위 실시간 대기질 묶음 (3D 지도 1회 호출용).
 * stale=true면 외부 API 장애로 마지막 정상 데이터를 반환한 것이다.
 */
public record CurrentAirQualityResponse(
        String sido,
        String source,
        boolean mock,
        boolean stale,
        Instant collectedAt,
        String message,
        List<StationAirQuality> stations
) {
}
