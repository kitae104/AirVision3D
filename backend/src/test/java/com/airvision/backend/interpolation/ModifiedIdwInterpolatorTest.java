package com.airvision.backend.interpolation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

import com.airvision.backend.interpolation.IdwInterpolator.SourcePoint;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Modified IDW 검증. 기대값은 Python 기준 구현(scripts/modified_idw_reference.py)
 * 실행 결과이며 허용오차 1e-6 이내 일치를 확인한다 (Phase 3 IDW 교차검증과 동일 방식).
 */
class ModifiedIdwInterpolatorTest {

    private static final double TOLERANCE = 1e-6;

    private static final List<SourcePoint> SEOUL = List.of(
            new SourcePoint(37.5665, 126.9780, 25.0),
            new SourcePoint(37.4979, 127.0276, 40.0),
            new SourcePoint(37.5268, 126.9244, 10.0));

    private static final List<SourcePoint> INCHEON = List.of(
            new SourcePoint(37.4646, 126.6803, 18.0),   // 미추홀주안
            new SourcePoint(37.4487, 126.7016, 27.0),   // 남동구월
            new SourcePoint(37.4013, 126.7300, 35.0),   // 남동논현
            new SourcePoint(37.4090, 126.6660, 12.0),   // 연수동춘
            new SourcePoint(37.3925, 126.6350, 8.0));   // 연수송도

    @Test
    @DisplayName("보정값이 Python 기준 구현과 1e-6 이내로 일치한다")
    void correctionsMatchPythonReference() {
        double[] seoul = ModifiedIdwInterpolator.corrections(SEOUL, 2.0);
        assertThat(seoul[0]).isCloseTo(1.2050048654, within(TOLERANCE));
        assertThat(seoul[1]).isCloseTo(2.0000000000, within(TOLERANCE));
        assertThat(seoul[2]).isCloseTo(1.9011270292, within(TOLERANCE));

        double[] incheon = ModifiedIdwInterpolator.corrections(INCHEON, 2.0);
        assertThat(incheon[0]).isCloseTo(1.3701858094, within(TOLERANCE));
        assertThat(incheon[1]).isCloseTo(1.4696914858, within(TOLERANCE));
        assertThat(incheon[2]).isCloseTo(2.0000000000, within(TOLERANCE));
        assertThat(incheon[3]).isCloseTo(1.3102862453, within(TOLERANCE));
        assertThat(incheon[4]).isCloseTo(1.4836601593, within(TOLERANCE));
    }

    @Test
    @DisplayName("최종 보간값이 Python 기준 구현과 1e-6 이내로 일치한다")
    void interpolateMatchesPythonReference() {
        assertThat(ModifiedIdwInterpolator.interpolate(SEOUL, 37.5400, 126.9900, 2.0))
                .isCloseTo(25.4674347721, within(TOLERANCE));
        assertThat(ModifiedIdwInterpolator.interpolate(SEOUL, 37.5400, 126.9900, 1.0))
                .isCloseTo(25.3220171591, within(TOLERANCE));
        assertThat(ModifiedIdwInterpolator.interpolate(INCHEON, 37.4300, 126.6900, 2.0))
                .isCloseTo(22.5466767340, within(TOLERANCE));
    }

    @Test
    @DisplayName("일반 IDW와는 다른 값을 낸다 (보정 가중치 효과)")
    void differsFromStandardIdw() {
        double modified = ModifiedIdwInterpolator.interpolate(INCHEON, 37.4300, 126.6900, 2.0);
        double standard = IdwInterpolator.interpolate(INCHEON, 37.4300, 126.6900, 2.0);
        assertThat(modified).isNotCloseTo(standard, within(1e-3));
    }

    @Test
    @DisplayName("대상이 관측지점과 동일 좌표면 관측값을 그대로 반환한다")
    void coincidentTargetReturnsObservedValue() {
        assertThat(ModifiedIdwInterpolator.interpolate(INCHEON, 37.4646, 126.6803, 2.0))
                .isEqualTo(18.0);
    }

    @Test
    @DisplayName("단일 관측지점이면 그 값을 반환한다 (보정 중립화)")
    void singleSourceReturnsItsValue() {
        assertThat(ModifiedIdwInterpolator.interpolate(
                INCHEON.subList(0, 1), 37.4300, 126.6900, 2.0))
                .isCloseTo(18.0, within(TOLERANCE));
    }

    @Test
    @DisplayName("모든 관측값이 같으면(1차 오차 전부 0) 일반 IDW처럼 그 값을 반환한다")
    void allEqualValuesFallBackToPlainIdw() {
        List<SourcePoint> equal = INCHEON.stream()
                .map(s -> new SourcePoint(s.latitude(), s.longitude(), 20.0))
                .toList();
        assertThat(ModifiedIdwInterpolator.interpolate(equal, 37.4300, 126.6900, 2.0))
                .isCloseTo(20.0, within(TOLERANCE));
    }

    @Test
    @DisplayName("빈 관측지점 목록과 비양수 p는 IllegalArgumentException")
    void invalidInputs() {
        assertThatThrownBy(() -> ModifiedIdwInterpolator.interpolate(
                List.of(), 37.43, 126.69, 2.0))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> ModifiedIdwInterpolator.interpolate(
                INCHEON, 37.43, 126.69, 0.0))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
