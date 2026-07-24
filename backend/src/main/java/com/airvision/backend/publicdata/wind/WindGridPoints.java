package com.airvision.backend.publicdata.wind;

import java.util.List;

/**
 * 바람장 수집 대상 인천권 영역과 KMA 격자 샘플 지점.
 * 핵심 3구(미추홀·남동·연수)를 중심으로 이류 계산에 필요한 상류(주변부)까지 포함한다.
 */
public final class WindGridPoints {

    public static final double WEST = 126.45;
    public static final double SOUTH = 37.25;
    public static final double EAST = 126.95;
    public static final double NORTH = 37.60;

    public record Point(double latitude, double longitude) {
    }

    /** 3×3 샘플 격자 (경도 3 × 위도 3). 각 지점은 KMA 5km 격자로 변환해 예보를 조회한다. */
    public static final List<Point> POINTS = List.of(
            new Point(37.31, 126.51), new Point(37.31, 126.70), new Point(37.31, 126.89),
            new Point(37.43, 126.51), new Point(37.43, 126.70), new Point(37.43, 126.89),
            new Point(37.55, 126.51), new Point(37.55, 126.70), new Point(37.55, 126.89));

    private WindGridPoints() {
    }
}
