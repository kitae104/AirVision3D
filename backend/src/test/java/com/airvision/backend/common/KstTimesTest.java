package com.airvision.backend.common;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import org.junit.jupiter.api.Test;

class KstTimesTest {

    @Test
    void KST_시각_문자열을_UTC_Instant로_변환한다() {
        // KST 14:00 = UTC 05:00
        assertThat(KstTimes.parseDataTime("2026-07-18 14:00"))
                .isEqualTo(Instant.parse("2026-07-18T05:00:00Z"));
    }

    @Test
    void 자정_24시_표기는_다음날_00시로_처리한다() {
        assertThat(KstTimes.parseDataTime("2026-07-18 24:00"))
                .isEqualTo(KstTimes.parseDataTime("2026-07-19 00:00"));
    }

    @Test
    void 빈_값과_형식_오류는_null을_반환한다() {
        assertThat(KstTimes.parseDataTime(null)).isNull();
        assertThat(KstTimes.parseDataTime("")).isNull();
        assertThat(KstTimes.parseDataTime("-")).isNull();
        assertThat(KstTimes.parseDataTime("2026/07/18 14시")).isNull();
    }

    @Test
    void 기상청_yyyyMMdd_HHmm_형식을_변환한다() {
        // KST 06:00 = UTC 前日 21:00
        assertThat(KstTimes.parseKmaDateTime("20260718", "0600"))
                .isEqualTo(Instant.parse("2026-07-17T21:00:00Z"));
        assertThat(KstTimes.parseKmaDateTime("bad", "0600")).isNull();
        assertThat(KstTimes.parseKmaDateTime(null, null)).isNull();
    }
}
