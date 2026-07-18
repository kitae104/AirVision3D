package com.airvision.backend.publicdata.history.dto;

import java.time.Instant;

public record MeasurementHourlyPoint(Instant hour, Double avgPm10, Double avgPm25, long count) {
}
