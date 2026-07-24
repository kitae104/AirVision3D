package com.airvision.backend.publicdata.kma;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import org.junit.jupiter.api.Test;

class WindUtilsTest {

    @Test
    void 풍향_각도를_16방위_한글로_변환한다() {
        assertThat(WindUtils.toText16(0)).isEqualTo("북풍");
        assertThat(WindUtils.toText16(45)).isEqualTo("북동풍");
        assertThat(WindUtils.toText16(90)).isEqualTo("동풍");
        assertThat(WindUtils.toText16(180)).isEqualTo("남풍");
        assertThat(WindUtils.toText16(270)).isEqualTo("서풍");
        assertThat(WindUtils.toText16(315)).isEqualTo("북서풍");
        assertThat(WindUtils.toText16(360)).isEqualTo("북풍");
    }

    @Test
    void 경계값은_가까운_방위로_반올림된다() {
        assertThat(WindUtils.toText16(11.2)).isEqualTo("북풍");
        assertThat(WindUtils.toText16(11.3)).isEqualTo("북북동풍");
        assertThat(WindUtils.toText16(348.7)).isEqualTo("북북서풍");
        assertThat(WindUtils.toText16(348.8)).isEqualTo("북풍");
    }

    @Test
    void 풍향_풍속을_UV_성분으로_변환한다() {
        // 서풍(VEC=270, 서에서 불어옴) → 동쪽으로 이동: u=+speed, v=0
        assertThat(WindUtils.toU(3.0, 270)).isCloseTo(3.0, within(1e-9));
        assertThat(WindUtils.toV(3.0, 270)).isCloseTo(0.0, within(1e-9));
        // 북풍(VEC=0) → 남쪽으로 이동: u=0, v=-speed
        assertThat(WindUtils.toU(2.0, 0)).isCloseTo(0.0, within(1e-9));
        assertThat(WindUtils.toV(2.0, 0)).isCloseTo(-2.0, within(1e-9));
        // 남동풍(VEC=135) → 북서로 이동: u<0, v>0
        assertThat(WindUtils.toU(1.0, 135)).isLessThan(0);
        assertThat(WindUtils.toV(1.0, 135)).isGreaterThan(0);
    }

    @Test
    void 기상학적_풍향을_지도_화살표_방향으로_반전한다() {
        // 북서풍(315도, 북서에서 불어옴)의 이동 방향은 남동(135도)
        assertThat(WindUtils.arrowHeadingDeg(315)).isEqualTo(135);
        assertThat(WindUtils.arrowHeadingDeg(0)).isEqualTo(180);
        assertThat(WindUtils.arrowHeadingDeg(180)).isEqualTo(0);
        assertThat(WindUtils.arrowHeadingDeg(270)).isEqualTo(90);
    }
}
