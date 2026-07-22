package com.airvision.backend.interpolation;

import com.airvision.backend.common.GeoUtils;
import com.airvision.backend.interpolation.IdwInterpolator.SourcePoint;
import java.util.List;

/**
 * Modified IDW 보간 (최종보고서 §4.1.2 결측구간 보간 알고리즘).
 *
 * 절차 (보고서 표 3-11):
 *  1. 각 관측지점 간 거리를 계산한다.
 *  2. 1차 가중치(w = 1/d^p, 자기 자신은 제외)를 계산한다.
 *  3. 각 관측지점에서 leave-one-out 1차 보간값을 구한다.
 *  4. 1차 보간값과 실제 관측값의 절대 오차를 구한다.
 *  5. 보정값 c_i = 1 + |오차_i| / max|오차| 를 구한다 (오차가 큰 지점일수록 가중 강화).
 *  6. 보정된 2차 가중치 w_i = c_i / d_i^p 를 계산한다.
 *  7. 2차 가중치로 최종 보간값을 계산한다.
 *
 * 보고서 구현과의 의도적 차이 2건:
 *  - 대상 지점이 관측지점과 동일 좌표면 관측값을 그대로 반환한다
 *    (보고서 코드는 해당 지점 가중치를 0으로 두어 실측을 제외 — 기존 IdwInterpolator 규약에 맞춤).
 *  - 1차 보간 오차가 전부 0이면 보정값을 전부 1로 두어 일반 IDW와 동일하게 동작한다
 *    (보고서 코드는 보정값 0 → 최종값 0 반환).
 *  - 거리는 보고서의 구면 코사인 법칙 대신 기존 GeoUtils.haversineKm을 재사용한다
 *    (보고서 2차 검증에서도 haversine 라이브러리로 통일해 오차를 해소함 — 표 3-14).
 *
 * 기준 구현: scripts/modified_idw_reference.py (교차검증용)
 */
public final class ModifiedIdwInterpolator {

    private ModifiedIdwInterpolator() {
    }

    /**
     * @param sources   관측지점 목록 (1개 이상)
     * @param targetLat 보간 대상 위도
     * @param targetLon 보간 대상 경도
     * @param power     거리 가중치 지수 p (> 0, 보고서는 2 고정)
     */
    public static double interpolate(List<SourcePoint> sources,
                                     double targetLat, double targetLon, double power) {
        double[] corrections = corrections(sources, power);
        return estimate(sources, corrections, targetLat, targetLon, power);
    }

    /**
     * 관측지점별 보정값 c_i (절차 1~5). 대상 지점이 많을 때 한 번 계산해 재사용할 수 있다.
     */
    public static double[] corrections(List<SourcePoint> sources, double power) {
        if (sources == null || sources.isEmpty()) {
            throw new IllegalArgumentException("관측지점 목록이 비어 있습니다");
        }
        if (power <= 0) {
            throw new IllegalArgumentException("거리 가중치 지수 p는 0보다 커야 합니다");
        }

        int n = sources.size();
        double[] errors = new double[n];
        double maxError = 0.0;
        for (int i = 0; i < n; i++) {
            SourcePoint self = sources.get(i);
            double weightSum = 0.0;
            double weightedValueSum = 0.0;
            for (int j = 0; j < n; j++) {
                if (j == i) {
                    continue; // 자기 자신 제외 (leave-one-out)
                }
                SourcePoint other = sources.get(j);
                double distanceKm = GeoUtils.haversineKm(
                        other.latitude(), other.longitude(), self.latitude(), self.longitude());
                if (distanceKm < IdwInterpolator.ZERO_DISTANCE_EPSILON_KM) {
                    continue; // 중복 좌표 관측지점은 1차 보간에서 제외
                }
                double weight = 1.0 / Math.pow(distanceKm, power);
                weightSum += weight;
                weightedValueSum += weight * other.value();
            }
            // 이웃이 없으면(단일 관측지점 등) 1차 보간 불가 → 오차 0으로 두어 보정 중립화
            errors[i] = weightSum == 0.0 ? 0.0
                    : Math.abs(self.value() - weightedValueSum / weightSum);
            maxError = Math.max(maxError, errors[i]);
        }

        double[] corrections = new double[n];
        for (int i = 0; i < n; i++) {
            corrections[i] = maxError == 0.0 ? 1.0 : 1.0 + errors[i] / maxError;
        }
        return corrections;
    }

    /**
     * 보정값을 이용한 최종 보간 (절차 6~7). corrections는 {@link #corrections}의 결과여야 한다.
     */
    public static double estimate(List<SourcePoint> sources, double[] corrections,
                                  double targetLat, double targetLon, double power) {
        if (corrections == null || corrections.length != sources.size()) {
            throw new IllegalArgumentException("보정값 개수가 관측지점 수와 다릅니다");
        }
        double weightSum = 0.0;
        double weightedValueSum = 0.0;
        for (int i = 0; i < sources.size(); i++) {
            SourcePoint source = sources.get(i);
            double distanceKm = GeoUtils.haversineKm(
                    source.latitude(), source.longitude(), targetLat, targetLon);
            if (distanceKm < IdwInterpolator.ZERO_DISTANCE_EPSILON_KM) {
                return source.value();
            }
            double weight = corrections[i] / Math.pow(distanceKm, power);
            weightSum += weight;
            weightedValueSum += weight * source.value();
        }
        return weightedValueSum / weightSum;
    }
}
