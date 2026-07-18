package com.airvision.backend.publicdata.airkorea.dto;

import java.time.Instant;
import java.util.List;

/** 초미세먼지 주간예보 (정규화 응답). */
public record WeeklyForecastResponse(
        Instant announcedAt,
        List<WeeklyDay> days
) {

    public record WeeklyDay(String date, String content) {
    }
}
