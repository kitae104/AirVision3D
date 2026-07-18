package com.airvision.backend.publicdata.airkorea;

import com.airvision.backend.common.KstTimes;
import com.airvision.backend.publicdata.AirKoreaProperties;
import com.airvision.backend.publicdata.ExternalApiException;
import com.airvision.backend.publicdata.ExternalApiUnavailableException;
import com.airvision.backend.publicdata.FixtureLoader;
import com.airvision.backend.publicdata.PublicDataNotConfiguredException;
import com.airvision.backend.publicdata.PublicDataProperties;
import com.airvision.backend.publicdata.ServiceKeys;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * AirKorea OpenAPI 클라이언트 (측정소정보 / 실시간 측정 / 예보 / 경보).
 * Mock 모드에서는 실제 응답 구조와 동일한 fixture JSON을 같은 파싱 경로로 반환한다.
 *
 * <p>요청 주소·파라미터는 공공데이터포털 문서 기준 (2026-07-18 확인):
 * MsrstnInfoInqireSvc/getMsrstnList, ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty(ver=1.3),
 * getMinuDustFrcstDspth, getMinuDustWeekFrcstDspth, UlfptcaAlarmInqireSvc/getUlfptcaAlarmInfo.</p>
 */
@Component
public class AirKoreaClient {

    private static final Logger log = LoggerFactory.getLogger(AirKoreaClient.class);
    private static final DateTimeFormatter DATE = DateTimeFormatter.ISO_LOCAL_DATE;

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final String serviceKey;
    private final boolean mock;
    private final Clock clock;

    @org.springframework.beans.factory.annotation.Autowired
    public AirKoreaClient(AirKoreaProperties props, PublicDataProperties publicDataProps) {
        // Boot 4 기본 구성에는 Jackson 2 ObjectMapper 빈이 없으므로 직접 생성한다
        // (SecurityConfig와 동일한 이유). 원본 필드가 전부 String이라 기본 설정으로 충분하다.
        this(props, publicDataProps, new ObjectMapper(),
                defaultRestClient(props.baseUrl()), Clock.systemUTC());
    }

    AirKoreaClient(AirKoreaProperties props, PublicDataProperties publicDataProps,
                   ObjectMapper objectMapper, RestClient restClient, Clock clock) {
        this.restClient = restClient;
        this.objectMapper = objectMapper;
        this.serviceKey = ServiceKeys.normalize(props.serviceKey());
        this.mock = publicDataProps.mockActive(props.serviceKey());
        this.clock = clock;
        if (mock) {
            log.info("AirKorea 클라이언트: Mock 모드로 동작 (서비스키 미설정 또는 강제 설정)");
        }
    }

    private static RestClient defaultRestClient(String baseUrl) {
        var requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(java.time.Duration.ofSeconds(5));
        requestFactory.setReadTimeout(java.time.Duration.ofSeconds(15));
        return RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                .build();
    }

    public boolean isMock() {
        return mock;
    }

    /** 측정소 목록 (전국). */
    public List<AirKoreaRaw.StationItem> stations() {
        return fetch("airkorea/raw/stations.json",
                "/MsrstnInfoInqireSvc/getMsrstnList?serviceKey={key}&returnType=json&numOfRows=1000&pageNo=1",
                Map.of("key", requireKey()),
                new TypeReference<>() {
                });
    }

    /** 시도별 실시간 측정정보 (ver=1.3: PM2.5 포함). */
    public List<AirKoreaRaw.RealtimeItem> realtime(String sidoName) {
        return fetch("airkorea/raw/realtime.json",
                "/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty?serviceKey={key}&returnType=json"
                        + "&numOfRows=1000&pageNo=1&sidoName={sido}&ver=1.3",
                Map.of("key", requireKey(), "sido", sidoName),
                new TypeReference<>() {
                });
    }

    /** 대기질 예보통보 (오늘·내일·모레). informCode: PM10 | PM25 | O3 */
    public List<AirKoreaRaw.ForecastItem> forecast(LocalDate searchDate, String informCode) {
        return fetch("airkorea/raw/forecast.json",
                "/ArpltnInforInqireSvc/getMinuDustFrcstDspth?serviceKey={key}&returnType=json"
                        + "&numOfRows=100&pageNo=1&searchDate={date}&InformCode={code}",
                Map.of("key", requireKey(), "date", DATE.format(searchDate), "code", informCode),
                new TypeReference<>() {
                });
    }

    /** 초미세먼지 주간예보. */
    public List<AirKoreaRaw.ForecastItem> weeklyForecast(LocalDate searchDate) {
        return fetch("airkorea/raw/forecast_weekly.json",
                "/ArpltnInforInqireSvc/getMinuDustWeekFrcstDspth?serviceKey={key}&returnType=json"
                        + "&numOfRows=10&pageNo=1&searchDate={date}",
                Map.of("key", requireKey(), "date", DATE.format(searchDate)),
                new TypeReference<>() {
                });
    }

    /** 미세먼지 경보 발령 현황 (연도별). */
    public List<AirKoreaRaw.AlertItem> alerts(int year) {
        return fetch("airkorea/raw/alerts.json",
                "/UlfptcaAlarmInqireSvc/getUlfptcaAlarmInfo?serviceKey={key}&returnType=json"
                        + "&numOfRows=1000&pageNo=1&year={year}",
                Map.of("key", requireKey(), "year", String.valueOf(year)),
                new TypeReference<>() {
                });
    }

    private String requireKey() {
        if (mock) {
            return "mock";
        }
        if (serviceKey.isBlank()) {
            throw new PublicDataNotConfiguredException(
                    "AirKorea 서비스키가 설정되지 않았습니다. .env의 AIRKOREA_SERVICE_KEY를 입력하거나 "
                            + "PUBLIC_DATA_MOCK_ENABLED=true로 Mock 모드를 사용하세요");
        }
        return serviceKey;
    }

    private <T> List<T> fetch(String fixture, String uriTemplate, Map<String, String> uriVars,
                              TypeReference<AirKoreaRaw.Envelope<T>> typeRef) {
        String body = mock
                ? FixtureLoader.load(fixture, mockReplacements())
                : getWithRetry(uriTemplate, uriVars);
        return parse(body, typeRef);
    }

    private String getWithRetry(String uriTemplate, Map<String, String> uriVars) {
        int attempts = 0;
        while (true) {
            attempts++;
            try {
                return restClient.get().uri(uriTemplate, uriVars).retrieve().body(String.class);
            } catch (HttpStatusCodeException e) {
                int code = e.getStatusCode().value();
                boolean retryable = code == 429 || code == 502 || code == 503 || code == 504;
                if (retryable && attempts < 2) {
                    continue;
                }
                throw new ExternalApiException(
                        "AirKorea API 오류 (HTTP %d)".formatted(code), e);
            } catch (RestClientException e) {
                if (attempts < 2) {
                    continue;
                }
                throw new ExternalApiUnavailableException(
                        "AirKorea API에 연결할 수 없습니다 (네트워크/타임아웃)", e);
            }
        }
    }

    private <T> List<T> parse(String body, TypeReference<AirKoreaRaw.Envelope<T>> typeRef) {
        if (body == null || body.isBlank()) {
            throw new ExternalApiException("AirKorea API가 빈 응답을 반환했습니다");
        }
        String trimmed = body.trim();
        // 인증 오류 등은 HTTP 200 + XML(OpenAPI_ServiceResponse)로 오는 경우가 있다
        if (trimmed.startsWith("<")) {
            throw new ExternalApiException("AirKorea API 오류 응답: " + xmlErrorSummary(trimmed));
        }
        AirKoreaRaw.Envelope<T> envelope;
        try {
            envelope = objectMapper.readValue(trimmed, typeRef);
        } catch (com.fasterxml.jackson.core.JacksonException e) {
            throw new ExternalApiException("AirKorea API 응답 형식을 해석할 수 없습니다", e);
        }
        if (envelope == null || envelope.response() == null || envelope.response().header() == null) {
            throw new ExternalApiException("AirKorea API 응답 구조가 예상과 다릅니다");
        }
        AirKoreaRaw.Header header = envelope.response().header();
        if (!"00".equals(header.resultCode())) {
            throw new ExternalApiException("AirKorea API 오류 (resultCode=%s): %s"
                    .formatted(header.resultCode(), header.resultMsg()));
        }
        AirKoreaRaw.Body<T> respBody = envelope.response().body();
        return respBody == null || respBody.items() == null ? List.of() : respBody.items();
    }

    /** data.go.kr XML 오류 응답에서 메시지만 추출 (키는 로그에 남기지 않음). */
    private static String xmlErrorSummary(String xml) {
        String msg = between(xml, "<returnAuthMsg>", "</returnAuthMsg>");
        if (msg == null) {
            msg = between(xml, "<errMsg>", "</errMsg>");
        }
        return msg != null ? msg : "인증 또는 요청 형식 오류 (XML 응답)";
    }

    private static String between(String text, String start, String end) {
        int s = text.indexOf(start);
        int e = text.indexOf(end);
        return s >= 0 && e > s ? text.substring(s + start.length(), e) : null;
    }

    /** Mock fixture의 날짜 플레이스홀더를 현재(KST) 기준 값으로 치환. */
    private Map<String, String> mockReplacements() {
        LocalDateTime now = KstTimes.nowKst(clock);
        Map<String, String> map = new HashMap<>();
        map.put("__DATA_TIME__", now.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:00")));
        map.put("__TODAY__", now.toLocalDate().format(DATE));
        map.put("__TOMORROW__", now.toLocalDate().plusDays(1).format(DATE));
        map.put("__DAY3__", now.toLocalDate().plusDays(2).format(DATE));
        map.put("__YEAR__", String.valueOf(now.getYear()));
        for (int i = 1; i <= 4; i++) {
            map.put("__W" + i + "__", now.toLocalDate().plusDays(2 + i).format(DATE));
        }
        return map;
    }
}
