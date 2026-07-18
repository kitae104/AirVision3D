package com.airvision.backend.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class TtlCacheTest {

    /** 테스트에서 시간을 임의로 진행시키는 Clock. */
    static class MutableClock extends Clock {
        private Instant now = Instant.parse("2026-07-18T00:00:00Z");

        void advance(Duration d) {
            now = now.plus(d);
        }

        @Override
        public ZoneId getZone() {
            return ZoneId.of("UTC");
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }

    @Test
    void TTL이_지나기_전에는_로더를_다시_호출하지_않는다() {
        MutableClock clock = new MutableClock();
        TtlCache<String, String> cache = new TtlCache<>(Duration.ofMinutes(30), clock);
        AtomicInteger calls = new AtomicInteger();

        cache.get("k", () -> "v" + calls.incrementAndGet());
        clock.advance(Duration.ofMinutes(29));
        TtlCache.CachedValue<String> result = cache.get("k", () -> "v" + calls.incrementAndGet());

        assertThat(calls.get()).isEqualTo(1);
        assertThat(result.value()).isEqualTo("v1");
        assertThat(result.stale()).isFalse();
    }

    @Test
    void TTL이_지나면_다시_로드한다() {
        MutableClock clock = new MutableClock();
        TtlCache<String, String> cache = new TtlCache<>(Duration.ofMinutes(30), clock);
        AtomicInteger calls = new AtomicInteger();

        cache.get("k", () -> "v" + calls.incrementAndGet());
        clock.advance(Duration.ofMinutes(31));
        TtlCache.CachedValue<String> result = cache.get("k", () -> "v" + calls.incrementAndGet());

        assertThat(calls.get()).isEqualTo(2);
        assertThat(result.value()).isEqualTo("v2");
    }

    @Test
    void 재로드_실패_시_마지막_정상_값을_stale로_반환한다() {
        MutableClock clock = new MutableClock();
        TtlCache<String, String> cache = new TtlCache<>(Duration.ofMinutes(30), clock);

        cache.get("k", () -> "good");
        Instant firstLoadedAt = cache.loadedAt("k");
        clock.advance(Duration.ofMinutes(31));
        TtlCache.CachedValue<String> result = cache.get("k", () -> {
            throw new IllegalStateException("API down");
        });

        assertThat(result.value()).isEqualTo("good");
        assertThat(result.stale()).isTrue();
        assertThat(result.loadedAt()).isEqualTo(firstLoadedAt);
    }

    @Test
    void 캐시가_없는_상태에서_로드_실패하면_예외를_그대로_던진다() {
        TtlCache<String, String> cache = new TtlCache<>(Duration.ofMinutes(30), new MutableClock());

        assertThatThrownBy(() -> cache.get("k", () -> {
            throw new IllegalStateException("API down");
        })).isInstanceOf(IllegalStateException.class);
    }
}
