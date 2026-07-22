package com.airvision.backend.publicdata.odor;

import com.airvision.backend.common.TtlCache;
import com.airvision.backend.publicdata.OdorProperties;
import com.airvision.backend.publicdata.odor.dto.OdorMeasurement;
import com.airvision.backend.publicdata.odor.dto.OdorResponse;
import com.airvision.backend.publicdata.odor.dto.OdorSpotResponse;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * 악취 측정 현황 조회 서비스.
 * 사업소별 TTL 캐시(기본 24시간 — 연 단위 개방 자료)로 운영하며, 사업소 단위 장애를 격리한다
 * (한 사업소 조회 실패가 전체 응답 실패로 번지지 않도록 failedOffices로 보고).
 * 같은 측정지점의 반복 측정은 지점 단위(최신값·최대값·건수)로 집계한다.
 */
@Service
public class OdorService {

    private static final Logger log = LoggerFactory.getLogger(OdorService.class);

    private final OdorClient client;
    private final OdorProperties props;
    private final TtlCache<String, List<OdorMeasurement>> cache;

    @org.springframework.beans.factory.annotation.Autowired
    public OdorService(OdorClient client, OdorProperties props) {
        this(client, props, Clock.systemUTC());
    }

    OdorService(OdorClient client, OdorProperties props, Clock clock) {
        this.client = client;
        this.props = props;
        this.cache = new TtlCache<>(Duration.ofSeconds(props.cacheSeconds()), clock);
    }

    public boolean isMock() {
        return client.isMock();
    }

    /** 전체 사업소 악취 측정 현황 (지점 단위 집계). */
    public OdorResponse measurements() {
        List<OdorMeasurement> all = new ArrayList<>();
        List<String> failed = new ArrayList<>();
        boolean stale = false;
        Instant loadedAt = null;
        for (OdorProperties.Dataset dataset : props.datasetsOrEmpty()) {
            try {
                TtlCache.CachedValue<List<OdorMeasurement>> cached = cache.get(dataset.office(),
                        () -> OdorNormalizer.normalize(dataset.office(), client.rows(dataset)));
                all.addAll(cached.value());
                stale = stale || cached.stale();
                if (loadedAt == null || cached.loadedAt().isAfter(loadedAt)) {
                    loadedAt = cached.loadedAt();
                }
            } catch (RuntimeException e) {
                log.warn("악취 데이터 조회 실패 ({}): {}", dataset.office(), e.getMessage());
                failed.add(dataset.office());
            }
        }
        List<OdorSpotResponse> spots = aggregate(all);
        return new OdorResponse(client.isMock(), stale, loadedAt, spots.size(), spots, failed);
    }

    /** (사업소, 측정지점) 단위 집계. 지점명이 없으면 주소를 지점 식별자로 사용한다. */
    private List<OdorSpotResponse> aggregate(List<OdorMeasurement> measurements) {
        Map<String, List<OdorMeasurement>> bySpot = new LinkedHashMap<>();
        for (OdorMeasurement m : measurements) {
            String spotKey = m.spotName() != null ? m.spotName() : m.address();
            if (spotKey == null) {
                continue;
            }
            bySpot.computeIfAbsent(m.office() + "|" + spotKey, k -> new ArrayList<>()).add(m);
        }
        List<OdorSpotResponse> spots = new ArrayList<>();
        for (List<OdorMeasurement> group : bySpot.values()) {
            // 측정일 문자열(yyyy-MM-dd 계열)은 사전순 = 시간순. 형식이 섞여도 최신 근사값으로 동작
            OdorMeasurement latest = group.stream()
                    .max(Comparator.comparing(m -> m.measuredDate() == null ? "" : m.measuredDate()))
                    .orElseThrow();
            Double maxDilution = group.stream()
                    .map(OdorMeasurement::dilution)
                    .filter(java.util.Objects::nonNull)
                    .max(Double::compare)
                    .orElse(null);
            // 좌표는 그룹 내 첫 유효값 사용 (같은 지점의 좌표 누락 행 보완)
            OdorMeasurement located = group.stream()
                    .filter(m -> m.latitude() != null && m.longitude() != null)
                    .findFirst()
                    .orElse(latest);
            boolean locationAvailable = located.latitude() != null && located.longitude() != null;
            spots.add(new OdorSpotResponse(
                    latest.office(),
                    latest.spotName() != null ? latest.spotName() : latest.address(),
                    latest.address(),
                    located.latitude(), located.longitude(), locationAvailable,
                    latest.measuredDate(), latest.dilution(), maxDilution, group.size()));
        }
        spots.sort(Comparator
                .comparing(OdorSpotResponse::office)
                .thenComparing(s -> s.latestDilution() == null ? Double.MIN_VALUE : s.latestDilution(),
                        Comparator.reverseOrder()));
        return spots;
    }
}
