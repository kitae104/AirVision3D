package com.airvision.backend.publicdata.kma;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;

class KmaBaseTimeTest {

    private static Clock kstClock(String kstIso) {
        // KST 문자열을 UTC Instant로 바꿔 고정 Clock 생성
        return Clock.fixed(Instant.parse(kstIso).minusSeconds(9 * 3600), ZoneId.of("UTC"));
    }

    @Test
    void 초단기실황은_45분_이전이면_이전_시각_발표를_쓴다() {
        // KST 14:30 → 13시 발표 자료
        KmaBaseTime.BaseDateTime base = KmaBaseTime.forUltraNcst(kstClock("2026-07-18T14:30:00Z"));
        assertThat(base.baseDate()).isEqualTo("20260718");
        assertThat(base.baseTime()).isEqualTo("1300");
    }

    @Test
    void 초단기실황은_45분_이후면_현재_시각_발표를_쓴다() {
        KmaBaseTime.BaseDateTime base = KmaBaseTime.forUltraNcst(kstClock("2026-07-18T14:50:00Z"));
        assertThat(base.baseTime()).isEqualTo("1400");
    }

    @Test
    void 자정_직후에는_전날_23시_발표를_쓴다() {
        KmaBaseTime.BaseDateTime base = KmaBaseTime.forUltraNcst(kstClock("2026-07-18T00:10:00Z"));
        assertThat(base.baseDate()).isEqualTo("20260717");
        assertThat(base.baseTime()).isEqualTo("2300");
    }

    @Test
    void 초단기예보는_base_time이_HH30이다() {
        KmaBaseTime.BaseDateTime base = KmaBaseTime.forUltraFcst(kstClock("2026-07-18T14:55:00Z"));
        assertThat(base.baseTime()).isEqualTo("1430");
        KmaBaseTime.BaseDateTime earlier = KmaBaseTime.forUltraFcst(kstClock("2026-07-18T14:40:00Z"));
        assertThat(earlier.baseTime()).isEqualTo("1330");
    }
}
