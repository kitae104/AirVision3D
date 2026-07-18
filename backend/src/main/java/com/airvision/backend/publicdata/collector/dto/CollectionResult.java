package com.airvision.backend.publicdata.collector.dto;

import java.time.Instant;

/** 1회 수집 결과 요약. */
public record CollectionResult(int measurementsUpserted, int weatherUpserted,
                               int comparisonSnapshots, boolean mock, Instant collectedAt) {
}
