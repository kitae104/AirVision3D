package com.airvision.backend.publicdata.history.dto;

import com.airvision.backend.publicdata.history.ComparisonHistory;
import java.time.Instant;

public record ComparisonHistoryPoint(Instant computedAt, String siteName, Instant predictedAt,
                                     double predictedPm25, String stationName,
                                     Double measuredPm25, Double absoluteError,
                                     Double errorRatePercent) {

    public static ComparisonHistoryPoint from(ComparisonHistory h) {
        return new ComparisonHistoryPoint(h.getComputedAt(), h.getSiteName(), h.getPredictedAt(),
                h.getPredictedPm25(), h.getStationName(), h.getMeasuredPm25(),
                h.getAbsoluteError(), h.getErrorRatePercent());
    }
}
