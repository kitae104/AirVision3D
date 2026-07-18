package com.airvision.backend.publicdata.airkorea.dto;

import java.time.Instant;

/** 측정소 1곳의 실시간 대기질 (정규화 응답, 좌표는 측정소정보와 결합). */
public record StationAirQuality(
        String stationName,
        String sidoName,
        Double latitude,
        Double longitude,
        boolean locationAvailable,
        Instant measuredAt,
        PollutantValue pm10,
        PollutantValue pm25,
        PollutantValue o3,
        PollutantValue no2,
        PollutantValue co,
        PollutantValue so2,
        PollutantValue khai
) {
}
