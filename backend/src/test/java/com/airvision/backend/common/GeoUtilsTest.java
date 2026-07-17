package com.airvision.backend.common;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Haversine 거리 검증.
 * 기대값은 scripts/idw_reference.py 실행 결과(Python 기준 구현)이다.
 */
class GeoUtilsTest {

    private static final double TOLERANCE = 1e-6;

    @Test
    void haversine_seoulCityHallToGangnam() {
        double km = GeoUtils.haversineKm(37.5665, 126.9780, 37.4979, 127.0276);
        assertThat(km).isCloseTo(8.7929030260, org.assertj.core.data.Offset.offset(TOLERANCE));
    }

    @Test
    void haversine_seoulToBusan() {
        double km = GeoUtils.haversineKm(37.5665, 126.9780, 35.1796, 129.0756);
        assertThat(km).isCloseTo(325.1117079126, org.assertj.core.data.Offset.offset(TOLERANCE));
    }

    @Test
    void haversine_samePoint_isZero() {
        assertThat(GeoUtils.haversineKm(37.5, 127.0, 37.5, 127.0)).isZero();
    }

    @Test
    void haversine_isSymmetric() {
        double ab = GeoUtils.haversineKm(37.5665, 126.9780, 35.1796, 129.0756);
        double ba = GeoUtils.haversineKm(35.1796, 129.0756, 37.5665, 126.9780);
        assertThat(ab).isEqualTo(ba);
    }
}
