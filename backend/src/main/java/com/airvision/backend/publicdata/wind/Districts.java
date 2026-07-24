package com.airvision.backend.publicdata.wind;

import java.util.List;

/**
 * 인천 핵심 3구(미추홀·남동·연수)의 중심좌표와 근사 bounding box.
 * 중심좌표는 프론트 sido.ts의 구 이동 좌표와 동일하게 유지한다.
 * bbox는 행정경계 폴리곤이 아닌 근사 사각형으로, 구별 평균 집계 용도다.
 */
public final class Districts {

    public record District(String name, double centerLat, double centerLon,
                           double west, double south, double east, double north) {

        public boolean contains(double lat, double lon) {
            return lat >= south && lat <= north && lon >= west && lon <= east;
        }
    }

    public static final List<District> CORE_THREE = List.of(
            new District("미추홀구", 37.46, 126.665, 126.62, 37.42, 126.71, 37.50),
            new District("남동구", 37.435, 126.72, 126.68, 37.38, 126.78, 37.49),
            new District("연수구", 37.405, 126.67, 126.60, 37.35, 126.71, 37.44));

    private Districts() {
    }
}
