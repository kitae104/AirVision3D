package com.airvision.backend.publicdata.airkorea.dto;

import com.airvision.backend.publicdata.airkorea.AirKoreaNormalizer;
import java.time.Instant;
import java.util.List;

/** 대기질 예보통보 1건 (예보 대상일 기준, 정규화 응답). */
public record ForecastResponse(
        String informCode,
        String forecastDate,
        Instant announcedAt,
        String overall,
        String cause,
        String actionKnack,
        List<AirKoreaNormalizer.RegionGrade> grades,
        List<String> imageUrls
) {
}
