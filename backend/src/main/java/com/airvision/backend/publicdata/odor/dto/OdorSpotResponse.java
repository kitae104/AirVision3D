package com.airvision.backend.publicdata.odor.dto;

/** 측정지점 단위 요약 (같은 지점의 반복 측정을 최신·최대값으로 집계). */
public record OdorSpotResponse(
        String office,
        String spotName,
        String address,
        Double latitude,
        Double longitude,
        boolean locationAvailable,
        String latestDate,
        Double latestDilution,
        Double maxDilution,
        int measurementCount
) {
}
