package com.airvision.backend.publicdata.wind.dto;

import java.time.Instant;
import java.util.List;

/** 정규 격자 바람장. u/v는 row 0=남쪽, index = row*width+col (cesium-wind-layer 입력 순서). */
public record WindFieldResponse(Bounds bounds, int width, int height, Instant baseTime,
                                String source, boolean mock, boolean stale,
                                List<HourField> hours) {

    public record Bounds(double west, double south, double east, double north) {
    }

    public record HourField(Instant time, List<Double> u, List<Double> v,
                            double speedMin, double speedMax) {
    }

    public WindFieldResponse asStale() {
        return new WindFieldResponse(bounds, width, height, baseTime, source, mock, true, hours);
    }
}
