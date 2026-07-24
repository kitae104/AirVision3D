package com.airvision.backend.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

import java.time.Instant;
import org.junit.jupiter.api.Test;

/**
 * 기준값은 ai-service의 Python 구현(app/common/solar.py, NOAA 근사식)으로 산출했다.
 * Java 포트가 동일 결과(1e-4 이내)를 내는지 교차검증한다.
 */
class SolarUtilsTest {

    @Test
    void 파이썬_기준_구현과_태양고도가_일치한다() {
        assertThat(SolarUtils.solarElevationDeg(37.46, 126.665,
                Instant.parse("2026-07-18T03:00:00Z")))
                .isCloseTo(71.67557, within(1e-4));
        assertThat(SolarUtils.solarElevationDeg(37.46, 126.665,
                Instant.parse("2026-07-18T15:00:00Z")))
                .isCloseTo(-30.652566, within(1e-4));
        assertThat(SolarUtils.solarElevationDeg(37.46, 126.665,
                Instant.parse("2026-01-15T07:30:00Z")))
                .isCloseTo(10.45827, within(1e-4));
        assertThat(SolarUtils.solarElevationDeg(37.435, 126.72,
                Instant.parse("2026-07-18T21:00:00Z")))
                .isCloseTo(5.318158, within(1e-4));
    }

    @Test
    void 정오는_양수_자정은_음수다() {
        // 인천 기준: 12:00 KST = 03:00Z 양수, 00:00 KST = 15:00Z 음수
        assertThat(SolarUtils.solarElevationDeg(37.46, 126.665,
                Instant.parse("2026-07-18T03:00:00Z"))).isPositive();
        assertThat(SolarUtils.solarElevationDeg(37.46, 126.665,
                Instant.parse("2026-07-18T15:00:00Z"))).isNegative();
    }

    @Test
    void 좌표_범위를_검증한다() {
        assertThatThrownBy(() -> SolarUtils.solarElevationDeg(91, 126.665,
                Instant.parse("2026-07-18T03:00:00Z")))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> SolarUtils.solarElevationDeg(37.46, 181,
                Instant.parse("2026-07-18T03:00:00Z")))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
