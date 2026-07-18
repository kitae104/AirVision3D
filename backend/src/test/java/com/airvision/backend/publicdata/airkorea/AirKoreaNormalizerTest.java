package com.airvision.backend.publicdata.airkorea;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class AirKoreaNormalizerTest {

    @Test
    void 정상_숫자는_valid로_변환한다() {
        var m = AirKoreaNormalizer.measured("42", null);
        assertThat(m.value()).isEqualTo(42.0);
        assertThat(m.valid()).isTrue();
        assertThat(m.status()).isEqualTo(AirKoreaNormalizer.STATUS_NORMAL);
    }

    @Test
    void 값_0은_결측이_아니라_정상_측정값이다() {
        var m = AirKoreaNormalizer.measured("0", null);
        assertThat(m.value()).isEqualTo(0.0);
        assertThat(m.valid()).isTrue();
    }

    @Test
    void 하이픈과_빈값과_null은_NO_DATA다() {
        assertThat(AirKoreaNormalizer.measured("-", null).status())
                .isEqualTo(AirKoreaNormalizer.STATUS_NO_DATA);
        assertThat(AirKoreaNormalizer.measured("", null).status())
                .isEqualTo(AirKoreaNormalizer.STATUS_NO_DATA);
        assertThat(AirKoreaNormalizer.measured(null, null).status())
                .isEqualTo(AirKoreaNormalizer.STATUS_NO_DATA);
        assertThat(AirKoreaNormalizer.measured("-", null).valid()).isFalse();
        assertThat(AirKoreaNormalizer.measured("-", null).value()).isNull();
    }

    @Test
    void 통신장애와_점검_플래그를_구분한다() {
        assertThat(AirKoreaNormalizer.measured("-", "통신장애").status())
                .isEqualTo(AirKoreaNormalizer.STATUS_COMM_ERROR);
        assertThat(AirKoreaNormalizer.measured("-", "점검및교정").status())
                .isEqualTo(AirKoreaNormalizer.STATUS_MAINTENANCE);
        assertThat(AirKoreaNormalizer.measured("-", "자료이상").status())
                .isEqualTo(AirKoreaNormalizer.STATUS_INVALID);
    }

    @Test
    void 숫자가_아닌_값은_INVALID다() {
        assertThat(AirKoreaNormalizer.measured("점검중", null).status())
                .isEqualTo(AirKoreaNormalizer.STATUS_INVALID);
    }

    @Test
    void 등급_코드를_한글_등급명으로_변환한다() {
        assertThat(AirKoreaNormalizer.gradeLabel("1")).isEqualTo("좋음");
        assertThat(AirKoreaNormalizer.gradeLabel("2")).isEqualTo("보통");
        assertThat(AirKoreaNormalizer.gradeLabel("3")).isEqualTo("나쁨");
        assertThat(AirKoreaNormalizer.gradeLabel("4")).isEqualTo("매우나쁨");
        assertThat(AirKoreaNormalizer.gradeLabel("-")).isNull();
        assertThat(AirKoreaNormalizer.gradeLabel(null)).isNull();
    }

    @Test
    void 좌표는_비어_있으면_null이다() {
        assertThat(AirKoreaNormalizer.parseCoord("37.38256")).isEqualTo(37.38256);
        assertThat(AirKoreaNormalizer.parseCoord("")).isNull();
        assertThat(AirKoreaNormalizer.parseCoord("-")).isNull();
        assertThat(AirKoreaNormalizer.parseCoord(null)).isNull();
    }

    @Test
    void informGrade_문자열을_권역별_등급으로_파싱한다() {
        List<AirKoreaNormalizer.RegionGrade> grades =
                AirKoreaNormalizer.parseInformGrade("서울 : 나쁨,인천 : 보통,제주 : 좋음");
        assertThat(grades).hasSize(3);
        assertThat(grades.get(0).region()).isEqualTo("서울");
        assertThat(grades.get(0).grade()).isEqualTo("나쁨");
        assertThat(grades.get(1).region()).isEqualTo("인천");
    }

    @Test
    void informGrade_형식_오류_항목은_건너뛴다() {
        assertThat(AirKoreaNormalizer.parseInformGrade("서울 : 나쁨,깨진항목,인천 : 보통"))
                .hasSize(2);
        assertThat(AirKoreaNormalizer.parseInformGrade(null)).isEmpty();
    }

    @Test
    void 예보_발표시각을_파싱한다() {
        // KST 11시 = UTC 02시
        assertThat(AirKoreaNormalizer.parseAnnouncedTime("2026-07-18 11시 발표"))
                .isEqualTo(Instant.parse("2026-07-18T02:00:00Z"));
        assertThat(AirKoreaNormalizer.parseAnnouncedTime("2026-07-18 11:00"))
                .isEqualTo(Instant.parse("2026-07-18T02:00:00Z"));
        assertThat(AirKoreaNormalizer.parseAnnouncedTime("발표 없음")).isNull();
    }

    @Test
    void 주소에서_시도명을_추출한다() {
        assertThat(AirKoreaNormalizer.sidoOfAddr("인천 연수구 컨벤시아대로 391")).isEqualTo("인천");
        assertThat(AirKoreaNormalizer.sidoOfAddr(null)).isNull();
        assertThat(AirKoreaNormalizer.sidoOfAddr(" ")).isNull();
    }
}
