package com.airvision.backend.publicdata.kma;

import com.airvision.backend.common.KstTimes;
import com.airvision.backend.common.NotFoundException;
import com.airvision.backend.common.TtlCache;
import com.airvision.backend.publicdata.PublicDataProperties;
import com.airvision.backend.publicdata.airkorea.AirKoreaService;
import com.airvision.backend.publicdata.airkorea.dto.PublicStationResponse;
import com.airvision.backend.publicdata.kma.dto.WeatherForecastResponse;
import com.airvision.backend.publicdata.kma.dto.WeatherNowResponse;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/**
 * 기상청 초단기실황·초단기예보 조회 서비스.
 * TTL 인메모리 캐시 사용, |값|>=900은 결측으로 처리한다 (공식 문서 규칙).
 */
@Service
public class KmaWeatherService {

    private final KmaWeatherClient client;
    private final AirKoreaService airKoreaService;
    private final Clock clock;
    private final TtlCache<String, WeatherNowResponse> currentCache;
    private final TtlCache<String, WeatherForecastResponse> forecastCache;

    @org.springframework.beans.factory.annotation.Autowired
    public KmaWeatherService(KmaWeatherClient client, AirKoreaService airKoreaService,
                             PublicDataProperties publicDataProps) {
        this(client, airKoreaService, publicDataProps, Clock.systemUTC());
    }

    KmaWeatherService(KmaWeatherClient client, AirKoreaService airKoreaService,
                      PublicDataProperties publicDataProps, Clock clock) {
        this.client = client;
        this.airKoreaService = airKoreaService;
        this.clock = clock;
        Duration ttl = Duration.ofSeconds(publicDataProps.cache().weatherSeconds());
        this.currentCache = new TtlCache<>(ttl, clock);
        this.forecastCache = new TtlCache<>(ttl, clock);
    }

    public boolean isMock() {
        return client.isMock();
    }

    /** 좌표 기준 현재 기상 (초단기실황). */
    public WeatherNowResponse current(double latitude, double longitude) {
        AirKoreaService.validateCoordinates(latitude, longitude);
        KmaGridConverter.GridXY grid = KmaGridConverter.toGrid(latitude, longitude);
        String key = grid.nx() + "_" + grid.ny();
        TtlCache.CachedValue<WeatherNowResponse> cached = currentCache.get(key, () -> {
            KmaBaseTime.BaseDateTime base = KmaBaseTime.forUltraNcst(clock);
            List<KmaRaw.Item> items = client.ultraNcst(base, grid.nx(), grid.ny());
            return toNow(latitude, longitude, grid, base, items);
        });
        WeatherNowResponse value = cached.value();
        return cached.stale()
                ? new WeatherNowResponse(latitude, longitude, value.gridX(), value.gridY(),
                        value.baseTime(), value.source(), value.mock(), true,
                        value.temperature(), value.humidity(), value.precipitationMm(),
                        value.precipitationType(), value.windSpeed(),
                        value.windDirectionDegree(), value.windDirectionText(),
                        value.windArrowDegree())
                : value;
    }

    private WeatherNowResponse toNow(double latitude, double longitude,
                                     KmaGridConverter.GridXY grid,
                                     KmaBaseTime.BaseDateTime base, List<KmaRaw.Item> items) {
        Map<String, Double> values = new HashMap<>();
        for (KmaRaw.Item item : items) {
            Double v = parseValue(item.obsrValue());
            if (v != null && item.category() != null) {
                values.put(item.category(), v);
            }
        }
        Double vec = values.get("VEC");
        Instant baseInstant = KstTimes.parseKmaDateTime(base.baseDate(), base.baseTime());
        return new WeatherNowResponse(latitude, longitude, grid.nx(), grid.ny(),
                baseInstant, "KMA", client.isMock(), false,
                values.get("T1H"), values.get("REH"), values.get("RN1"),
                ptyText(values.get("PTY")),
                values.get("WSD"), vec,
                vec == null ? null : WindUtils.toText16(vec),
                vec == null ? null : WindUtils.arrowHeadingDeg(vec));
    }

    /** 좌표 기준 6시간 기상 예보 (초단기예보). */
    public WeatherForecastResponse forecast(double latitude, double longitude) {
        AirKoreaService.validateCoordinates(latitude, longitude);
        KmaGridConverter.GridXY grid = KmaGridConverter.toGrid(latitude, longitude);
        String key = grid.nx() + "_" + grid.ny();
        return forecastCache.get(key, () -> {
            KmaBaseTime.BaseDateTime base = KmaBaseTime.forUltraFcst(clock);
            List<KmaRaw.Item> items = client.ultraFcst(base, grid.nx(), grid.ny());
            return toForecast(latitude, longitude, base, items);
        }).value();
    }

    private WeatherForecastResponse toForecast(double latitude, double longitude,
                                               KmaBaseTime.BaseDateTime base,
                                               List<KmaRaw.Item> items) {
        // (예보일+예보시각) → 카테고리별 값으로 피벗
        Map<String, Map<String, String>> byTime = new LinkedHashMap<>();
        for (KmaRaw.Item item : items) {
            if (item.fcstDate() == null || item.fcstTime() == null || item.category() == null) {
                continue;
            }
            byTime.computeIfAbsent(item.fcstDate() + item.fcstTime(), k -> new HashMap<>())
                    .put(item.category(), item.fcstValue());
        }
        List<WeatherForecastResponse.Hour> hours = byTime.entrySet().stream()
                .map(entry -> {
                    String dateTime = entry.getKey();
                    Map<String, String> categories = entry.getValue();
                    Double vec = parseValue(categories.get("VEC"));
                    return new WeatherForecastResponse.Hour(
                            KstTimes.parseKmaDateTime(
                                    dateTime.substring(0, 8), dateTime.substring(8)),
                            parseValue(categories.get("T1H")),
                            parseValue(categories.get("REH")),
                            skyText(parseValue(categories.get("SKY"))),
                            ptyText(parseValue(categories.get("PTY"))),
                            parseValue(categories.get("WSD")),
                            vec,
                            vec == null ? null : WindUtils.toText16(vec));
                })
                .filter(h -> h.forecastAt() != null)
                .sorted(Comparator.comparing(WeatherForecastResponse.Hour::forecastAt))
                .toList();
        return new WeatherForecastResponse(latitude, longitude,
                KstTimes.parseKmaDateTime(base.baseDate(), base.baseTime()),
                "KMA", client.isMock(), hours);
    }

    /** AirKorea 측정소 좌표 기준 현재 기상. */
    public WeatherNowResponse byStation(String stationName) {
        PublicStationResponse station = airKoreaService.stations().value().stream()
                .filter(s -> stationName.equals(s.stationName()))
                .findFirst()
                .orElseThrow(() -> new NotFoundException("측정소", stationName));
        if (!station.locationAvailable()) {
            throw new IllegalStateException(
                    "측정소 좌표가 없어 기상정보를 조회할 수 없습니다: " + stationName);
        }
        return current(station.latitude(), station.longitude());
    }

    /** 문자열 값 → Double. 결측(|값|>=900) 및 숫자 아님은 null. */
    static Double parseValue(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            double v = Double.parseDouble(raw.trim());
            return Math.abs(v) >= 900 ? null : v;
        } catch (NumberFormatException e) {
            return null; // "강수없음" 등 문자열 값
        }
    }

    /** 강수형태 코드 → 표시 문구 (공식 코드표). */
    static String ptyText(Double code) {
        if (code == null) {
            return null;
        }
        return switch (code.intValue()) {
            case 0 -> "없음";
            case 1 -> "비";
            case 2 -> "비/눈";
            case 3 -> "눈";
            case 4 -> "소나기";
            case 5 -> "빗방울";
            case 6 -> "빗방울/눈날림";
            case 7 -> "눈날림";
            default -> null;
        };
    }

    /** 하늘상태 코드 → 표시 문구 (공식 코드표: 1 맑음, 3 구름많음, 4 흐림). */
    static String skyText(Double code) {
        if (code == null) {
            return null;
        }
        return switch (code.intValue()) {
            case 1 -> "맑음";
            case 3 -> "구름많음";
            case 4 -> "흐림";
            default -> null;
        };
    }

    /** 시스템 상태 카드용 요약. */
    public Map<String, Object> status() {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("mock", client.isMock());
        return map;
    }
}
