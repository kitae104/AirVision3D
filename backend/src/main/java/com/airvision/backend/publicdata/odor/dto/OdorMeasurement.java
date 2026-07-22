package com.airvision.backend.publicdata.odor.dto;

/** 정규화된 악취 측정 1건 (복합악취 희석배수). 좌표가 없으면 지도 표시에서 제외된다. */
public record OdorMeasurement(
        String office,
        String spotName,
        String address,
        Double latitude,
        Double longitude,
        String measuredDate,
        Double dilution
) {
}
