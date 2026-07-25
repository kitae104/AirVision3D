package com.airvision.backend.publicdata.cctv;

import com.airvision.backend.common.TtlCache;
import com.airvision.backend.publicdata.ItsCctvProperties;
import com.airvision.backend.publicdata.cctv.dto.CctvStreamsResponse;
import com.airvision.backend.publicdata.wind.Districts;
import java.time.Clock;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * 인천 핵심 3구(미추홀·남동·연수) 실시간 도로 CCTV 목록 서비스.
 * 3구를 덮는 사각 범위로 ITS API를 1회 조회한 뒤 구 bbox에 들어오는 카메라만 남기고,
 * 스트림 주소 만료에 대비해 짧은 TTL(기본 5분)로 캐시한다.
 */
@Service
public class CctvStreamService {

    /** 3구 bbox 합집합에 주변 도로가 걸치도록 주는 여유 (도) */
    static final double BBOX_MARGIN_DEG = 0.01;

    private final CctvClient client;
    private final TtlCache<String, List<CctvStreamsResponse.Camera>> cache;

    @org.springframework.beans.factory.annotation.Autowired
    public CctvStreamService(CctvClient client, ItsCctvProperties props) {
        this(client, props, Clock.systemUTC());
    }

    CctvStreamService(CctvClient client, ItsCctvProperties props, Clock clock) {
        this.client = client;
        this.cache = new TtlCache<>(Duration.ofSeconds(props.cacheSeconds()), clock);
    }

    public CctvStreamsResponse streams() {
        TtlCache.CachedValue<List<CctvStreamsResponse.Camera>> cached =
                cache.get("core3", this::load);
        List<CctvStreamsResponse.Camera> cameras = cached.value();
        return new CctvStreamsResponse(client.isMock(), cached.stale(), cached.loadedAt(),
                "ITS 국가교통정보센터", cameras.size(), cameras);
    }

    private List<CctvStreamsResponse.Camera> load() {
        double minX = Districts.CORE_THREE.stream()
                .mapToDouble(Districts.District::west).min().orElseThrow() - BBOX_MARGIN_DEG;
        double maxX = Districts.CORE_THREE.stream()
                .mapToDouble(Districts.District::east).max().orElseThrow() + BBOX_MARGIN_DEG;
        double minY = Districts.CORE_THREE.stream()
                .mapToDouble(Districts.District::south).min().orElseThrow() - BBOX_MARGIN_DEG;
        double maxY = Districts.CORE_THREE.stream()
                .mapToDouble(Districts.District::north).max().orElseThrow() + BBOX_MARGIN_DEG;

        List<CctvStreamsResponse.Camera> cameras = new ArrayList<>();
        for (CctvRaw.Item item : client.cctvs(minX, minY, maxX, maxY)) {
            Double lon = parse(item.coordx());
            Double lat = parse(item.coordy());
            if (lon == null || lat == null || item.cctvname() == null) {
                continue;
            }
            String district = districtOf(lat, lon);
            if (district == null) {
                continue; // 3구 밖 (bbox 여유 구간)
            }
            cameras.add(new CctvStreamsResponse.Camera(
                    item.cctvname().trim(), district, lat, lon,
                    item.cctvurl() == null ? "" : item.cctvurl().trim(),
                    item.cctvformat() == null ? "HLS" : item.cctvformat().trim()));
        }
        cameras.sort(Comparator
                .comparing(CctvStreamsResponse.Camera::district)
                .thenComparing(CctvStreamsResponse.Camera::name));
        return cameras;
    }

    private static String districtOf(double lat, double lon) {
        for (Districts.District d : Districts.CORE_THREE) {
            if (d.contains(lat, lon)) {
                return d.name();
            }
        }
        return null;
    }

    private static Double parse(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Double.parseDouble(value.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
