package com.airvision.backend.publicdata.airkorea;

import com.airvision.backend.common.GeoUtils;
import com.airvision.backend.common.KstTimes;
import com.airvision.backend.common.NotFoundException;
import com.airvision.backend.common.TtlCache;
import com.airvision.backend.publicdata.AirKoreaProperties;
import com.airvision.backend.publicdata.PublicDataProperties;
import com.airvision.backend.publicdata.airkorea.dto.AlertResponse;
import com.airvision.backend.publicdata.airkorea.dto.CurrentAirQualityResponse;
import com.airvision.backend.publicdata.airkorea.dto.ForecastResponse;
import com.airvision.backend.publicdata.airkorea.dto.PollutantValue;
import com.airvision.backend.publicdata.airkorea.dto.PublicStationResponse;
import com.airvision.backend.publicdata.airkorea.dto.StationAirQuality;
import com.airvision.backend.publicdata.airkorea.dto.WeeklyForecastResponse;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * AirKorea 데이터 조회 서비스.
 * DB에 저장하지 않고 TTL 인메모리 캐시로 운영한다 (구현 계획 문서의 저장 전략 결정 참고).
 * 외부 API 장애 시 마지막 정상 데이터를 stale=true로 반환한다.
 */
@Service
public class AirKoreaService {

    private static final Logger log = LoggerFactory.getLogger(AirKoreaService.class);

    /** AirKorea sidoName 허용값 (공식 문서 기준). */
    public static final Set<String> SIDO_NAMES = Set.of(
            "서울", "부산", "대구", "인천", "광주", "대전", "울산", "경기", "강원",
            "충북", "충남", "전북", "전남", "경북", "경남", "제주", "세종");

    static final String UNIT_UG = "µg/m³";
    static final String UNIT_PPM = "ppm";

    private final AirKoreaClient client;
    private final AirKoreaProperties props;
    private final Clock clock;

    private final TtlCache<String, List<PublicStationResponse>> stationCache;
    private final TtlCache<String, List<AirKoreaRaw.RealtimeItem>> realtimeCache;
    private final TtlCache<String, List<ForecastResponse>> forecastCache;
    private final TtlCache<String, WeeklyForecastResponse> weeklyCache;
    private final TtlCache<Integer, List<AlertResponse>> alertCache;

    public AirKoreaService(AirKoreaClient client, AirKoreaProperties props,
                           PublicDataProperties publicDataProps) {
        this(client, props, publicDataProps, Clock.systemUTC());
    }

    AirKoreaService(AirKoreaClient client, AirKoreaProperties props,
                    PublicDataProperties publicDataProps, Clock clock) {
        this.client = client;
        this.props = props;
        this.clock = clock;
        PublicDataProperties.Cache ttl = publicDataProps.cache();
        this.stationCache = new TtlCache<>(Duration.ofSeconds(ttl.stationsSeconds()), clock);
        this.realtimeCache = new TtlCache<>(Duration.ofSeconds(ttl.realtimeSeconds()), clock);
        this.forecastCache = new TtlCache<>(Duration.ofSeconds(ttl.forecastSeconds()), clock);
        this.weeklyCache = new TtlCache<>(Duration.ofSeconds(ttl.forecastSeconds()), clock);
        this.alertCache = new TtlCache<>(Duration.ofSeconds(ttl.alertsSeconds()), clock);
    }

    public String defaultSido() {
        return props.defaultSido();
    }

    public boolean isMock() {
        return client.isMock();
    }

    /** sidoName 검증 (외부 API로 임의 문자열 전달 방지). */
    public String validateSido(String sido) {
        String value = sido == null || sido.isBlank() ? props.defaultSido() : sido.trim();
        if (!SIDO_NAMES.contains(value)) {
            throw new IllegalArgumentException(
                    "지원하지 않는 시도명입니다: " + value + " (예: 서울, 인천, 경기)");
        }
        return value;
    }

    // ── 측정소 ──────────────────────────────────────────────

    /** 전국 측정소 목록 (24시간 캐시). */
    public TtlCache.CachedValue<List<PublicStationResponse>> stations() {
        return stationCache.get("all", () -> client.stations().stream()
                .map(this::toStation)
                .toList());
    }

    private PublicStationResponse toStation(AirKoreaRaw.StationItem item) {
        Double lat = AirKoreaNormalizer.parseCoord(item.dmX());
        Double lng = AirKoreaNormalizer.parseCoord(item.dmY());
        boolean locationAvailable = lat != null && lng != null;
        if (!locationAvailable) {
            log.info("측정소 좌표 누락: {} (dmX={}, dmY={}) — 지도 표시 제외",
                    item.stationName(), item.dmX(), item.dmY());
        }
        return new PublicStationResponse(item.stationName(), item.addr(),
                AirKoreaNormalizer.sidoOfAddr(item.addr()), item.mangName(), item.item(),
                lat, lng, locationAvailable, null);
    }

    /** 측정소 검색 (주소·측정소명 부분 일치). */
    public List<PublicStationResponse> searchStations(String addr, String stationName) {
        return stations().value().stream()
                .filter(s -> addr == null || addr.isBlank()
                        || (s.addr() != null && s.addr().contains(addr.trim())))
                .filter(s -> stationName == null || stationName.isBlank()
                        || (s.stationName() != null && s.stationName().contains(stationName.trim())))
                .toList();
    }

    /** 좌표 기준 근접 측정소 (거리 오름차순). */
    public List<PublicStationResponse> nearbyStations(double latitude, double longitude,
                                                      double radiusKm) {
        validateCoordinates(latitude, longitude);
        if (radiusKm <= 0 || radiusKm > 200) {
            throw new IllegalArgumentException("radiusKm은 0 초과 200 이하이어야 합니다");
        }
        return stations().value().stream()
                .filter(PublicStationResponse::locationAvailable)
                .map(s -> s.withDistance(
                        GeoUtils.haversineKm(latitude, longitude, s.latitude(), s.longitude())))
                .filter(s -> s.distanceKm() <= radiusKm)
                .sorted(Comparator.comparingDouble(PublicStationResponse::distanceKm))
                .toList();
    }

    public static void validateCoordinates(double latitude, double longitude) {
        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            throw new IllegalArgumentException("위도/경도 범위가 올바르지 않습니다");
        }
    }

    // ── 실시간 대기질 ──────────────────────────────────────

    /** 시도별 실시간 대기질 (측정소 좌표 결합, 3D 지도 1회 호출용). */
    public CurrentAirQualityResponse current(String sido) {
        String validSido = validateSido(sido);
        TtlCache.CachedValue<List<AirKoreaRaw.RealtimeItem>> cached =
                realtimeCache.get(validSido, () -> client.realtime(validSido));

        Map<String, PublicStationResponse> stationByName;
        try {
            stationByName = stations().value().stream()
                    .collect(Collectors.toMap(PublicStationResponse::stationName,
                            Function.identity(), (a, b) -> a));
        } catch (RuntimeException e) {
            // 측정소 목록 실패 시에도 측정값 자체는 반환 (좌표 없음 처리)
            log.warn("측정소 목록 조회 실패 — 좌표 없이 반환: {}", e.getMessage());
            stationByName = Map.of();
        }

        Map<String, PublicStationResponse> finalStations = stationByName;
        List<StationAirQuality> stations = cached.value().stream()
                .map(item -> toStationAirQuality(item, finalStations.get(item.stationName())))
                .toList();

        String message = cached.stale()
                ? "외부 API 연결 문제로 마지막 정상 데이터를 표시합니다." : null;
        return new CurrentAirQualityResponse(validSido, "AIRKOREA", client.isMock(),
                cached.stale(), cached.loadedAt(), message, stations);
    }

    /** 측정소 1곳의 실시간 대기질. sido를 모르면 측정소 주소에서 유추한다. */
    public StationAirQuality currentByStation(String stationName, String sido) {
        String resolvedSido = sido;
        if (resolvedSido == null || resolvedSido.isBlank()) {
            resolvedSido = stations().value().stream()
                    .filter(s -> stationName.equals(s.stationName()))
                    .map(PublicStationResponse::sido)
                    .filter(SIDO_NAMES::contains)
                    .findFirst()
                    .orElse(props.defaultSido());
        }
        return current(resolvedSido).stations().stream()
                .filter(s -> stationName.equals(s.stationName()))
                .findFirst()
                .orElseThrow(() -> new NotFoundException("측정소", stationName));
    }

    private StationAirQuality toStationAirQuality(AirKoreaRaw.RealtimeItem item,
                                                  PublicStationResponse station) {
        boolean hasLocation = station != null && station.locationAvailable();
        return new StationAirQuality(
                item.stationName(), item.sidoName(),
                hasLocation ? station.latitude() : null,
                hasLocation ? station.longitude() : null,
                hasLocation,
                KstTimes.parseDataTime(item.dataTime()),
                PollutantValue.of(AirKoreaNormalizer.measured(item.pm10Value(), item.pm10Flag()),
                        item.pm10Grade(), UNIT_UG),
                PollutantValue.of(AirKoreaNormalizer.measured(item.pm25Value(), item.pm25Flag()),
                        item.pm25Grade(), UNIT_UG),
                PollutantValue.of(AirKoreaNormalizer.measured(item.o3Value(), item.o3Flag()),
                        item.o3Grade(), UNIT_PPM),
                PollutantValue.of(AirKoreaNormalizer.measured(item.no2Value(), item.no2Flag()),
                        item.no2Grade(), UNIT_PPM),
                PollutantValue.of(AirKoreaNormalizer.measured(item.coValue(), item.coFlag()),
                        item.coGrade(), UNIT_PPM),
                PollutantValue.of(AirKoreaNormalizer.measured(item.so2Value(), item.so2Flag()),
                        item.so2Grade(), UNIT_PPM),
                PollutantValue.of(AirKoreaNormalizer.measured(item.khaiValue(), null),
                        item.khaiGrade(), null));
    }

    // ── 예보 ────────────────────────────────────────────────

    /**
     * 대기질 예보통보. informCode: PM10 | PM25 | O3.
     * 같은 예보 대상일에 발표가 여러 번이면 최신 발표만 남긴다.
     */
    public TtlCache.CachedValue<List<ForecastResponse>> forecast(String informCode) {
        String code = validateInformCode(informCode);
        LocalDate today = KstTimes.nowKst(clock).toLocalDate();
        return forecastCache.get(code, () -> {
            List<AirKoreaRaw.ForecastItem> items = client.forecast(today, code);
            Map<String, AirKoreaRaw.ForecastItem> latestByDate = new LinkedHashMap<>();
            for (AirKoreaRaw.ForecastItem item : items) {
                if (item.informData() == null) {
                    continue;
                }
                latestByDate.merge(item.informData(), item, (a, b) -> {
                    String at = a.dataTime() == null ? "" : a.dataTime();
                    String bt = b.dataTime() == null ? "" : b.dataTime();
                    return at.compareTo(bt) >= 0 ? a : b;
                });
            }
            return latestByDate.values().stream()
                    .map(this::toForecast)
                    .sorted(Comparator.comparing(ForecastResponse::forecastDate,
                            Comparator.nullsLast(Comparator.naturalOrder())))
                    .toList();
        });
    }

    private ForecastResponse toForecast(AirKoreaRaw.ForecastItem item) {
        List<String> imageUrls = new ArrayList<>();
        for (String url : new String[]{item.imageUrl1(), item.imageUrl2(), item.imageUrl3()}) {
            if (url != null && !url.isBlank() && url.startsWith("http")) {
                imageUrls.add(url);
            }
        }
        return new ForecastResponse(item.informCode(), item.informData(),
                AirKoreaNormalizer.parseAnnouncedTime(item.dataTime()),
                item.informOverall(), item.informCause(), item.actionKnack(),
                AirKoreaNormalizer.parseInformGrade(item.informGrade()), imageUrls);
    }

    private static String validateInformCode(String informCode) {
        String code = informCode == null || informCode.isBlank() ? "PM25" : informCode.trim();
        if (!Set.of("PM10", "PM25", "O3").contains(code)) {
            throw new IllegalArgumentException("informCode는 PM10, PM25, O3 중 하나여야 합니다");
        }
        return code;
    }

    /** 초미세먼지 주간예보 (최신 발표 1건). */
    public TtlCache.CachedValue<WeeklyForecastResponse> weeklyForecast() {
        LocalDate today = KstTimes.nowKst(clock).toLocalDate();
        return weeklyCache.get("weekly", () -> {
            List<AirKoreaRaw.ForecastItem> items = client.weeklyForecast(today);
            AirKoreaRaw.ForecastItem latest = items.stream()
                    .max(Comparator.comparing(i -> i.dataTime() == null ? "" : i.dataTime()))
                    .orElse(null);
            if (latest == null) {
                return new WeeklyForecastResponse(null, List.of());
            }
            List<WeeklyForecastResponse.WeeklyDay> days = new ArrayList<>();
            addDay(days, latest.frcstOneDt(), latest.frcstOneCn());
            addDay(days, latest.frcstTwoDt(), latest.frcstTwoCn());
            addDay(days, latest.frcstThreeDt(), latest.frcstThreeCn());
            addDay(days, latest.frcstFourDt(), latest.frcstFourCn());
            return new WeeklyForecastResponse(
                    AirKoreaNormalizer.parseAnnouncedTime(latest.dataTime()), days);
        });
    }

    private static void addDay(List<WeeklyForecastResponse.WeeklyDay> days,
                               String date, String content) {
        if (date != null && !date.isBlank()) {
            days.add(new WeeklyForecastResponse.WeeklyDay(date.trim(), content));
        }
    }

    // ── 경보 ────────────────────────────────────────────────

    /** 연도별 경보 발령 현황 (발령시각 내림차순). */
    public TtlCache.CachedValue<List<AlertResponse>> alerts(Integer year) {
        int targetYear = year == null ? KstTimes.nowKst(clock).getYear() : year;
        if (targetYear < 2015 || targetYear > KstTimes.nowKst(clock).getYear()) {
            throw new IllegalArgumentException("year는 2015 이후 현재 연도 이하이어야 합니다");
        }
        return alertCache.get(targetYear, () -> client.alerts(targetYear).stream()
                .map(this::toAlert)
                .sorted(Comparator.comparing(AlertResponse::issuedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .toList());
    }

    /** 현재 발령 중(미해제) 경보. */
    public List<AlertResponse> activeAlerts() {
        return alerts(null).value().stream()
                .filter(AlertResponse::active)
                .toList();
    }

    private AlertResponse toAlert(AirKoreaRaw.AlertItem item) {
        Instant issuedAt = joinDateTime(item.issueDate(), item.issueTime());
        Instant clearedAt = joinDateTime(item.clearDate(), item.clearTime());
        boolean active = clearedAt == null
                && (item.clearDate() == null || item.clearDate().isBlank());
        return new AlertResponse(item.districtName(), item.moveName(), item.itemCode(),
                item.issueGbn(), issuedAt,
                AirKoreaNormalizer.parseCoord(item.issueVal()),
                clearedAt,
                AirKoreaNormalizer.parseCoord(item.clearVal()),
                active);
    }

    private static Instant joinDateTime(String date, String time) {
        if (date == null || date.isBlank()) {
            return null;
        }
        String hhmm = time == null || time.isBlank() ? "00:00" : time.trim();
        return KstTimes.parseDataTime(date.trim() + " " + hhmm);
    }

    // ── 상태 ────────────────────────────────────────────────

    /** 시스템 상태 카드용 요약 (마지막 수집시각 등). */
    public Map<String, Object> status() {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("mock", client.isMock());
        map.put("defaultSido", props.defaultSido());
        map.put("stationsLoadedAt", stationCache.loadedAt("all"));
        map.put("realtimeLoadedAt", realtimeCache.loadedAt(props.defaultSido()));
        map.put("forecastLoadedAt", forecastCache.loadedAt("PM25"));
        map.put("alertsLoadedAt", alertCache.loadedAt(KstTimes.nowKst(clock).getYear()));
        return map;
    }
}
