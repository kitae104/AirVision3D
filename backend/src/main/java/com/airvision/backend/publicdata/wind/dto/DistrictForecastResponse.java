package com.airvision.backend.publicdata.wind.dto;

import java.time.Instant;
import java.util.List;

/**
 * 인천 핵심 3구(미추홀·남동·연수) 확산 예측 요약.
 * current는 실측 IDW 기반 현재 추정치, hourly는 단순 이류(advection-only) 예측이다.
 */
public record DistrictForecastResponse(
        Instant baseTime,
        String source,
        String model,
        boolean mock,
        List<DistrictNow> current,
        List<HourForecast> hourly) {

    /** 바람 벡터 요약. directionDeg는 기상학적 풍향(불어오는 방향, 북=0). */
    public record WindVector(Double speedMs, Double directionDeg,
                             String directionText, String movementText) {
    }

    public record DistrictNow(String district, Double pm25, Double pm10, WindVector wind) {
    }

    public record HourForecast(Instant time, List<DistrictForecastValue> districts) {
    }

    public record DistrictForecastValue(String district, Double pm25, Double pm10,
                                        WindVector wind) {
    }
}
