package com.airvision.backend.interpolation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.airvision.backend.interpolation.IdwInterpolator.SourcePoint;
import java.util.List;
import org.assertj.core.data.Offset;
import org.junit.jupiter.api.Test;

/**
 * 일반 IDW 보간 검증.
 * 기대값은 scripts/idw_reference.py 실행 결과(Python 기준 구현)로,
 * Java 구현이 허용오차 1e-6 이내로 일치해야 한다. (Phase 3 완료 조건)
 */
class IdwInterpolatorTest {

    private static final Offset<Double> TOLERANCE = Offset.offset(1e-6);

    /** 검증 픽스처: 서울시청 / 강남역 / 여의도공원 (Python 스크립트와 동일) */
    private static final List<SourcePoint> SOURCES = List.of(
            new SourcePoint(37.5665, 126.9780, 25.0),
            new SourcePoint(37.4979, 127.0276, 40.0),
            new SourcePoint(37.5268, 126.9244, 10.0));

    private static final double TARGET_LAT = 37.5400;
    private static final double TARGET_LON = 126.9900;

    @Test
    void interpolate_powerTwo_matchesPythonReference() {
        double value = IdwInterpolator.interpolate(SOURCES, TARGET_LAT, TARGET_LON, 2.0);
        assertThat(value).isCloseTo(25.2155319213, TOLERANCE);
    }

    @Test
    void interpolate_powerOne_matchesPythonReference() {
        double value = IdwInterpolator.interpolate(SOURCES, TARGET_LAT, TARGET_LON, 1.0);
        assertThat(value).isCloseTo(25.1529967894, TOLERANCE);
    }

    @Test
    void interpolate_powerThree_matchesPythonReference() {
        double value = IdwInterpolator.interpolate(SOURCES, TARGET_LAT, TARGET_LON, 3.0);
        assertThat(value).isCloseTo(25.2082812034, TOLERANCE);
    }

    @Test
    void interpolate_onSourcePoint_returnsActualValue() {
        // 관측지점과 동일 좌표는 보간 없이 실제 관측값을 반환한다
        double value = IdwInterpolator.interpolate(SOURCES, 37.5665, 126.9780, 2.0);
        assertThat(value).isEqualTo(25.0);
    }

    @Test
    void interpolate_singleSource_returnsThatValue() {
        double value = IdwInterpolator.interpolate(SOURCES.subList(0, 1), TARGET_LAT, TARGET_LON, 2.0);
        assertThat(value).isCloseTo(25.0, TOLERANCE);
    }

    @Test
    void interpolate_resultIsWithinSourceValueRange() {
        // IDW는 가중평균이므로 결과가 관측값 범위 [10, 40]를 벗어날 수 없다
        double value = IdwInterpolator.interpolate(SOURCES, TARGET_LAT, TARGET_LON, 2.0);
        assertThat(value).isBetween(10.0, 40.0);
    }

    @Test
    void interpolate_emptySources_throws() {
        assertThatThrownBy(() -> IdwInterpolator.interpolate(List.of(), TARGET_LAT, TARGET_LON, 2.0))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void interpolate_nonPositivePower_throws() {
        assertThatThrownBy(() -> IdwInterpolator.interpolate(SOURCES, TARGET_LAT, TARGET_LON, 0.0))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
