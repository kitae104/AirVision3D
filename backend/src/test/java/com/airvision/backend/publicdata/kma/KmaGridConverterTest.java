package com.airvision.backend.publicdata.kma;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class KmaGridConverterTest {

    @Test
    void 서울_시청_좌표는_격자_60_127이다() {
        // 기상청 단기예보 지점 목록 기준 대표 좌표
        KmaGridConverter.GridXY grid = KmaGridConverter.toGrid(37.5665, 126.9780);
        assertThat(grid.nx()).isEqualTo(60);
        assertThat(grid.ny()).isEqualTo(127);
    }

    @Test
    void 인천_대표_좌표는_격자_55_124다() {
        KmaGridConverter.GridXY grid = KmaGridConverter.toGrid(37.4563, 126.7052);
        assertThat(grid.nx()).isEqualTo(55);
        assertThat(grid.ny()).isEqualTo(124);
    }

    @Test
    void 부산_대표_좌표는_격자_98_76이다() {
        KmaGridConverter.GridXY grid = KmaGridConverter.toGrid(35.1796, 129.0756);
        assertThat(grid.nx()).isEqualTo(98);
        assertThat(grid.ny()).isEqualTo(76);
    }

    @Test
    void 격자_기준점_원점_좌표를_변환할_수_있다() {
        // 기준점(위도 38, 경도 126)은 정의상 (43, 136)
        KmaGridConverter.GridXY grid = KmaGridConverter.toGrid(38.0, 126.0);
        assertThat(grid.nx()).isEqualTo(43);
        assertThat(grid.ny()).isEqualTo(136);
    }

    @Test
    void 잘못된_위경도는_예외다() {
        assertThatThrownBy(() -> KmaGridConverter.toGrid(95, 127))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> KmaGridConverter.toGrid(37.5, 200))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void 한반도에서_먼_좌표는_격자_범위_초과_예외다() {
        assertThatThrownBy(() -> KmaGridConverter.toGrid(0.0, 0.0))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("격자 범위");
    }
}
