package com.airvision.backend.interpolation;

import com.airvision.backend.common.GeoUtils;
import java.util.List;

/**
 * 일반 IDW(Inverse Distance Weighting) 보간.
 *
 * value(target) = Σ(w_i * v_i) / Σ(w_i),  w_i = 1 / d_i^p
 *
 * - 거리는 Haversine(km)을 사용한다.
 * - 대상 지점이 관측지점과 사실상 동일(엡실론 이내)하면 해당 관측값을 그대로 반환한다.
 * - 기준 구현: scripts/idw_reference.py (교차검증용)
 */
public final class IdwInterpolator {

    /** 이 거리(km) 미만이면 관측지점과 동일 좌표로 간주한다. */
    static final double ZERO_DISTANCE_EPSILON_KM = 1e-6;

    private IdwInterpolator() {
    }

    /** 관측지점 (위도, 경도, 값). */
    public record SourcePoint(double latitude, double longitude, double value) {
    }

    /**
     * @param sources   관측지점 목록 (1개 이상)
     * @param targetLat 보간 대상 위도
     * @param targetLon 보간 대상 경도
     * @param power     거리 가중치 지수 p (> 0)
     */
    public static double interpolate(List<SourcePoint> sources,
                                     double targetLat, double targetLon, double power) {
        if (sources == null || sources.isEmpty()) {
            throw new IllegalArgumentException("관측지점 목록이 비어 있습니다");
        }
        if (power <= 0) {
            throw new IllegalArgumentException("거리 가중치 지수 p는 0보다 커야 합니다");
        }

        double weightSum = 0.0;
        double weightedValueSum = 0.0;
        for (SourcePoint source : sources) {
            double distanceKm = GeoUtils.haversineKm(
                    source.latitude(), source.longitude(), targetLat, targetLon);
            if (distanceKm < ZERO_DISTANCE_EPSILON_KM) {
                return source.value();
            }
            double weight = 1.0 / Math.pow(distanceKm, power);
            weightSum += weight;
            weightedValueSum += weight * source.value();
        }
        return weightedValueSum / weightSum;
    }
}
