package com.airvision.backend.publicdata.wind.dto;

import java.time.Instant;
import java.util.List;

/**
 * 단순 이류(advection-only) 미세먼지 예측. pm25/pm10은 row 0=남쪽 row-major 배열.
 * pm10은 유효한 PM10 실측 지점이 없으면 null이다.
 */
public record AdvectionResponse(WindFieldResponse.Bounds bounds, int width, int height,
                                String model, boolean mock, List<Frame> frames) {

    public record Frame(Instant time, List<Double> pm25, List<Double> pm10) {
    }
}
