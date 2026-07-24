package com.airvision.backend.common;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;

/**
 * 태양고도(solar elevation) 계산 — NOAA 근사식(fractional year 기반 균시차·적위).
 * ai-service의 Python 구현(app/common/solar.py)과 동일 수식의 Java 포트이며,
 * 단위 테스트에서 Python 산출값과 1e-4 이내 일치를 교차검증한다.
 * 대기 굴절 보정은 하지 않는다 (야간 판정·특징 용도로 충분).
 */
public final class SolarUtils {

    private SolarUtils() {
    }

    /** 주어진 위치·시각(UTC)의 태양고도(도, 지평선 위 +, 아래 -)를 반환한다. */
    public static double solarElevationDeg(double latitudeDeg, double longitudeDeg,
                                           Instant when) {
        if (latitudeDeg < -90 || latitudeDeg > 90) {
            throw new IllegalArgumentException("위도 범위 오류: " + latitudeDeg);
        }
        if (longitudeDeg < -180 || longitudeDeg > 180) {
            throw new IllegalArgumentException("경도 범위 오류: " + longitudeDeg);
        }
        ZonedDateTime utc = when.atZone(ZoneOffset.UTC);
        int dayOfYear = utc.getDayOfYear();
        double fracHour = utc.getHour() + utc.getMinute() / 60.0 + utc.getSecond() / 3600.0;

        // fractional year (라디안)
        double gamma = 2 * Math.PI / 365 * (dayOfYear - 1 + (fracHour - 12) / 24);

        // 균시차 (분)
        double eqtime = 229.18 * (0.000075
                + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma)
                - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));

        // 태양 적위 (라디안)
        double decl = 0.006918
                - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma)
                - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma)
                - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);

        // 진태양시(분) → 시간각(라디안). cos은 주기함수라 범위 보정 불필요
        double trueSolarMinutes = fracHour * 60 + eqtime + 4 * longitudeDeg;
        double hourAngle = Math.toRadians(trueSolarMinutes / 4 - 180);

        double lat = Math.toRadians(latitudeDeg);
        double elevation = Math.asin(
                Math.sin(lat) * Math.sin(decl)
                        + Math.cos(lat) * Math.cos(decl) * Math.cos(hourAngle));
        return Math.toDegrees(elevation);
    }
}
