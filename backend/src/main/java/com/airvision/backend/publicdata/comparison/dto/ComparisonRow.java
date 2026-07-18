package com.airvision.backend.publicdata.comparison.dto;

import com.airvision.backend.prediction.PredictionRepository.LatestPrediction;
import java.time.Instant;

/**
 * AI 예측 1건과 최근접 공공 실측의 비교 결과.
 * matched=false면 비교값 없이 reason만 제공한다 (억지 비교 금지).
 */
public record ComparisonRow(
        Long siteId,
        String siteName,
        Instant predictedAt,
        double predictedPm25,
        String stationName,
        Instant measuredAt,
        Double measuredPm25,
        Double distanceKm,
        Long timeDiffMinutes,
        Double absoluteError,
        Double errorRatePercent,
        boolean matched,
        String reason
) {

    public static ComparisonRow unmatched(LatestPrediction prediction, String reason) {
        return new ComparisonRow(prediction.getSiteId(), prediction.getSiteName(),
                prediction.getPredictedAt(),
                Math.round(prediction.getPm25() * 10) / 10.0,
                null, null, null, null, null, null, null, false, reason);
    }
}
