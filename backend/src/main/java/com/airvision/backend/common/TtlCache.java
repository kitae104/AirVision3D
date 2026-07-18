package com.airvision.backend.common;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

/**
 * 의존성 없는 단순 TTL 인메모리 캐시.
 * 공공 API 응답처럼 갱신 주기가 있는 외부 데이터를 짧게 보관한다.
 *
 * <p>만료 후 재조회에 실패하면 마지막 정상 값을 stale=true로 반환한다
 * (외부 API 장애가 전체 장애로 번지지 않도록). 단일 프로세스 전용이며
 * 다중 서버 환경에서는 인스턴스별로 캐시가 분리된다.</p>
 */
public class TtlCache<K, V> {

    /** 캐시 조회 결과. stale=true면 만료된 마지막 정상 값이다. */
    public record CachedValue<V>(V value, Instant loadedAt, boolean stale) {
    }

    private record Entry<V>(V value, Instant loadedAt) {
    }

    private final Map<K, Entry<V>> entries = new ConcurrentHashMap<>();
    private final Duration ttl;
    private final Clock clock;

    public TtlCache(Duration ttl) {
        this(ttl, Clock.systemUTC());
    }

    public TtlCache(Duration ttl, Clock clock) {
        this.ttl = ttl;
        this.clock = clock;
    }

    /**
     * 캐시가 신선하면 그대로 반환하고, 만료됐으면 loader로 재조회한다.
     * 재조회 실패 시 이전 값이 있으면 stale로 반환하고, 없으면 예외를 그대로 던진다.
     */
    public CachedValue<V> get(K key, Supplier<V> loader) {
        Instant now = clock.instant();
        Entry<V> cached = entries.get(key);
        if (cached != null && cached.loadedAt().plus(ttl).isAfter(now)) {
            return new CachedValue<>(cached.value(), cached.loadedAt(), false);
        }
        try {
            V fresh = loader.get();
            Entry<V> entry = new Entry<>(fresh, now);
            entries.put(key, entry);
            return new CachedValue<>(fresh, now, false);
        } catch (RuntimeException e) {
            if (cached != null) {
                return new CachedValue<>(cached.value(), cached.loadedAt(), true);
            }
            throw e;
        }
    }

    /** 캐시된 항목의 적재 시각 (상태 표시용). 없으면 null. */
    public Instant loadedAt(K key) {
        Entry<V> cached = entries.get(key);
        return cached == null ? null : cached.loadedAt();
    }

    public void clear() {
        entries.clear();
    }
}
