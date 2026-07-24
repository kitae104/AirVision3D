package com.airvision.backend.publicdata.wind;

import com.airvision.backend.common.KstTimes;
import com.airvision.backend.common.TtlCache;
import com.airvision.backend.interpolation.IdwInterpolator;
import com.airvision.backend.publicdata.PublicDataProperties;
import com.airvision.backend.publicdata.kma.KmaBaseTime;
import com.airvision.backend.publicdata.kma.KmaGridConverter;
import com.airvision.backend.publicdata.kma.KmaRaw;
import com.airvision.backend.publicdata.kma.KmaWeatherClient;
import com.airvision.backend.publicdata.kma.KmaWeatherService;
import com.airvision.backend.publicdata.kma.WindUtils;
import com.airvision.backend.publicdata.wind.dto.WindFieldResponse;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import org.springframework.stereotype.Service;

/**
 * 인천권 KMA 격자점들의 초단기예보 바람(UUU/VVV)을 수집해
 * 25×25 정규 위경도 격자로 IDW 보간한 시간별 바람장을 만든다.
 */
@Service
public class WindFieldService {

    static final int WIDTH = 25;
    static final int HEIGHT = 25;
    static final double IDW_POWER = 2.0;

    private final KmaWeatherClient client;
    private final Clock clock;
    private final TtlCache<String, WindFieldResponse> cache;

    @org.springframework.beans.factory.annotation.Autowired
    public WindFieldService(KmaWeatherClient client, PublicDataProperties publicDataProps) {
        this(client, publicDataProps, Clock.systemUTC());
    }

    WindFieldService(KmaWeatherClient client, PublicDataProperties publicDataProps, Clock clock) {
        this.client = client;
        this.clock = clock;
        this.cache = new TtlCache<>(
                Duration.ofSeconds(publicDataProps.cache().weatherSeconds()), clock);
    }

    public WindFieldResponse field() {
        TtlCache.CachedValue<WindFieldResponse> cached = cache.get("field", this::load);
        return cached.stale() ? cached.value().asStale() : cached.value();
    }

    private WindFieldResponse load() {
        KmaBaseTime.BaseDateTime base = KmaBaseTime.forUltraFcst(clock);
        // KMA 격자(nx_ny)별 예보는 한 번만 조회하고, 샘플 지점마다 소속 격자의 시간별 (u,v)를 매핑
        Map<String, Map<Instant, double[]>> byGrid = new HashMap<>();
        // 시각 → 해당 시각에 값이 있는 샘플 지점들의 u/v IDW 소스
        Map<Instant, List<IdwInterpolator.SourcePoint>> uSources = new TreeMap<>();
        Map<Instant, List<IdwInterpolator.SourcePoint>> vSources = new TreeMap<>();

        for (WindGridPoints.Point p : WindGridPoints.POINTS) {
            KmaGridConverter.GridXY grid = KmaGridConverter.toGrid(p.latitude(), p.longitude());
            Map<Instant, double[]> hourly = byGrid.computeIfAbsent(
                    grid.nx() + "_" + grid.ny(), k -> fetchUv(base, grid));
            hourly.forEach((time, uv) -> {
                uSources.computeIfAbsent(time, t -> new ArrayList<>())
                        .add(new IdwInterpolator.SourcePoint(p.latitude(), p.longitude(), uv[0]));
                vSources.computeIfAbsent(time, t -> new ArrayList<>())
                        .add(new IdwInterpolator.SourcePoint(p.latitude(), p.longitude(), uv[1]));
            });
        }

        List<WindFieldResponse.HourField> hours = new ArrayList<>();
        for (Map.Entry<Instant, List<IdwInterpolator.SourcePoint>> entry : uSources.entrySet()) {
            if (hours.size() >= 6) {
                break;
            }
            Instant time = entry.getKey();
            hours.add(interpolateHour(time, entry.getValue(), vSources.get(time)));
        }

        return new WindFieldResponse(
                new WindFieldResponse.Bounds(WindGridPoints.WEST, WindGridPoints.SOUTH,
                        WindGridPoints.EAST, WindGridPoints.NORTH),
                WIDTH, HEIGHT,
                KstTimes.parseKmaDateTime(base.baseDate(), base.baseTime()),
                "KMA", client.isMock(), false, hours);
    }

    /** 격자점 1곳의 초단기예보를 시각별 (u, v)로 피벗. UUU/VVV 우선, 없으면 VEC/WSD 변환. */
    private Map<Instant, double[]> fetchUv(KmaBaseTime.BaseDateTime base,
                                           KmaGridConverter.GridXY grid) {
        List<KmaRaw.Item> items = client.ultraFcst(base, grid.nx(), grid.ny());
        Map<String, Map<String, String>> byTime = new LinkedHashMap<>();
        for (KmaRaw.Item item : items) {
            if (item.fcstDate() == null || item.fcstTime() == null || item.category() == null) {
                continue;
            }
            byTime.computeIfAbsent(item.fcstDate() + item.fcstTime(), k -> new HashMap<>())
                    .put(item.category(), item.fcstValue());
        }
        Map<Instant, double[]> result = new TreeMap<>();
        byTime.forEach((dateTime, categories) -> {
            Double u = KmaWeatherService.parseValue(categories.get("UUU"));
            Double v = KmaWeatherService.parseValue(categories.get("VVV"));
            if (u == null || v == null) {
                Double wsd = KmaWeatherService.parseValue(categories.get("WSD"));
                Double vec = KmaWeatherService.parseValue(categories.get("VEC"));
                if (wsd == null || vec == null) {
                    return; // 이 시각은 바람 정보 없음 → 제외
                }
                u = WindUtils.toU(wsd, vec);
                v = WindUtils.toV(wsd, vec);
            }
            Instant at = KstTimes.parseKmaDateTime(
                    dateTime.substring(0, 8), dateTime.substring(8));
            if (at != null) {
                result.put(at, new double[]{u, v});
            }
        });
        return result;
    }

    /** 샘플 지점 → 25×25 정규 격자 IDW 보간 (row 0 = 남쪽). */
    private static WindFieldResponse.HourField interpolateHour(
            Instant time, List<IdwInterpolator.SourcePoint> uSrc,
            List<IdwInterpolator.SourcePoint> vSrc) {
        List<Double> u = new ArrayList<>(WIDTH * HEIGHT);
        List<Double> v = new ArrayList<>(WIDTH * HEIGHT);
        double speedMin = Double.MAX_VALUE;
        double speedMax = 0;
        for (int row = 0; row < HEIGHT; row++) {
            double lat = WindGridPoints.SOUTH
                    + (row + 0.5) * (WindGridPoints.NORTH - WindGridPoints.SOUTH) / HEIGHT;
            for (int col = 0; col < WIDTH; col++) {
                double lon = WindGridPoints.WEST
                        + (col + 0.5) * (WindGridPoints.EAST - WindGridPoints.WEST) / WIDTH;
                double cu = IdwInterpolator.interpolate(uSrc, lat, lon, IDW_POWER);
                double cv = IdwInterpolator.interpolate(vSrc, lat, lon, IDW_POWER);
                u.add(cu);
                v.add(cv);
                double speed = Math.hypot(cu, cv);
                speedMin = Math.min(speedMin, speed);
                speedMax = Math.max(speedMax, speed);
            }
        }
        return new WindFieldResponse.HourField(time, u, v,
                speedMin == Double.MAX_VALUE ? 0 : speedMin, speedMax);
    }
}
