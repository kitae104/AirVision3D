package com.airvision.backend.publicdata.kma;

import com.airvision.backend.common.KstTimes;
import com.airvision.backend.publicdata.ExternalApiException;
import com.airvision.backend.publicdata.ExternalApiUnavailableException;
import com.airvision.backend.publicdata.FixtureLoader;
import com.airvision.backend.publicdata.KmaProperties;
import com.airvision.backend.publicdata.PublicDataNotConfiguredException;
import com.airvision.backend.publicdata.PublicDataProperties;
import com.airvision.backend.publicdata.ServiceKeys;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
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
 * 기상청 단기예보 조회서비스 2.0 클라이언트 (초단기실황·초단기예보).
 * Mock 모드에서는 실제 응답 구조와 동일한 fixture JSON을 같은 파싱 경로로 반환한다.
 */
@Component
public class KmaWeatherClient {

    private static final Logger log = LoggerFactory.getLogger(KmaWeatherClient.class);

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final String serviceKey;
    private final boolean mock;
    private final Clock clock;

    public KmaWeatherClient(KmaProperties props, PublicDataProperties publicDataProps,
                            ObjectMapper objectMapper) {
        this(props, publicDataProps, objectMapper,
                defaultRestClient(props.baseUrl()), Clock.systemUTC());
    }

    KmaWeatherClient(KmaProperties props, PublicDataProperties publicDataProps,
                     ObjectMapper objectMapper, RestClient restClient, Clock clock) {
        this.restClient = restClient;
        this.objectMapper = objectMapper;
        this.serviceKey = ServiceKeys.normalize(props.serviceKey());
        this.mock = publicDataProps.mockActive(props.serviceKey());
        this.clock = clock;
        if (mock) {
            log.info("기상청 클라이언트: Mock 모드로 동작 (서비스키 미설정 또는 강제 설정)");
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

    /** 초단기실황 (현재 관측에 가까운 값: T1H/RN1/UUU/VVV/REH/PTY/VEC/WSD). */
    public List<KmaRaw.Item> ultraNcst(KmaBaseTime.BaseDateTime base, int nx, int ny) {
        return fetch("kma/raw/ultra_ncst.json",
                "/VilageFcstInfoService_2.0/getUltraSrtNcst?serviceKey={key}&dataType=JSON"
                        + "&numOfRows=1000&pageNo=1&base_date={date}&base_time={time}&nx={nx}&ny={ny}",
                Map.of("key", requireKey(), "date", base.baseDate(), "time", base.baseTime(),
                        "nx", String.valueOf(nx), "ny", String.valueOf(ny)));
    }

    /** 초단기예보 (예보시점부터 6시간). */
    public List<KmaRaw.Item> ultraFcst(KmaBaseTime.BaseDateTime base, int nx, int ny) {
        return fetch("kma/raw/ultra_fcst.json",
                "/VilageFcstInfoService_2.0/getUltraSrtFcst?serviceKey={key}&dataType=JSON"
                        + "&numOfRows=1000&pageNo=1&base_date={date}&base_time={time}&nx={nx}&ny={ny}",
                Map.of("key", requireKey(), "date", base.baseDate(), "time", base.baseTime(),
                        "nx", String.valueOf(nx), "ny", String.valueOf(ny)));
    }

    private String requireKey() {
        if (mock) {
            return "mock";
        }
        if (serviceKey.isBlank()) {
            throw new PublicDataNotConfiguredException(
                    "기상청 서비스키가 설정되지 않았습니다. .env의 KMA_SERVICE_KEY를 입력하거나 "
                            + "PUBLIC_DATA_MOCK_ENABLED=true로 Mock 모드를 사용하세요");
        }
        return serviceKey;
    }

    private List<KmaRaw.Item> fetch(String fixture, String uriTemplate,
                                    Map<String, String> uriVars) {
        String body = mock
                ? FixtureLoader.load(fixture, mockReplacements())
                : getWithRetry(uriTemplate, uriVars);
        return parse(body);
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
                throw new ExternalApiException("기상청 API 오류 (HTTP %d)".formatted(code), e);
            } catch (RestClientException e) {
                if (attempts < 2) {
                    continue;
                }
                throw new ExternalApiUnavailableException(
                        "기상청 API에 연결할 수 없습니다 (네트워크/타임아웃)", e);
            }
        }
    }

    private List<KmaRaw.Item> parse(String body) {
        if (body == null || body.isBlank()) {
            throw new ExternalApiException("기상청 API가 빈 응답을 반환했습니다");
        }
        String trimmed = body.trim();
        // 인증 오류 등은 HTTP 200 + XML(OpenAPI_ServiceResponse)로 오는 경우가 있다
        if (trimmed.startsWith("<")) {
            String msg = between(trimmed, "<returnAuthMsg>", "</returnAuthMsg>");
            throw new ExternalApiException(
                    "기상청 API 오류 응답: " + (msg != null ? msg : "인증 또는 요청 형식 오류 (XML 응답)"));
        }
        KmaRaw.Envelope envelope;
        try {
            envelope = objectMapper.readValue(trimmed, KmaRaw.Envelope.class);
        } catch (com.fasterxml.jackson.core.JacksonException e) {
            throw new ExternalApiException("기상청 API 응답 형식을 해석할 수 없습니다", e);
        }
        if (envelope == null || envelope.response() == null
                || envelope.response().header() == null) {
            throw new ExternalApiException("기상청 API 응답 구조가 예상과 다릅니다");
        }
        KmaRaw.Header header = envelope.response().header();
        if ("03".equals(header.resultCode())) {
            return List.of(); // NO_DATA: 아직 발표되지 않은 시각 등 — 오류가 아닌 빈 결과
        }
        if (!"00".equals(header.resultCode())) {
            throw new ExternalApiException("기상청 API 오류 (resultCode=%s): %s"
                    .formatted(header.resultCode(), header.resultMsg()));
        }
        if (envelope.response().body() == null || envelope.response().body().items() == null
                || envelope.response().body().items().item() == null) {
            return List.of();
        }
        return envelope.response().body().items().item();
    }

    private static String between(String text, String start, String end) {
        int s = text.indexOf(start);
        int e = text.indexOf(end);
        return s >= 0 && e > s ? text.substring(s + start.length(), e) : null;
    }

    /** Mock fixture의 발표·예보시각 플레이스홀더 치환 (KST 기준). */
    private Map<String, String> mockReplacements() {
        DateTimeFormatter date = DateTimeFormatter.ofPattern("yyyyMMdd");
        Map<String, String> map = new HashMap<>();
        KmaBaseTime.BaseDateTime ncst = KmaBaseTime.forUltraNcst(clock);
        KmaBaseTime.BaseDateTime fcst = KmaBaseTime.forUltraFcst(clock);
        map.put("__BASE_DATE__", ncst.baseDate());
        map.put("__BASE_TIME__", ncst.baseTime());
        map.put("__FBASE_DATE__", fcst.baseDate());
        map.put("__FBASE_TIME__", fcst.baseTime());
        LocalDateTime kst = KstTimes.nowKst(clock).withMinute(0);
        for (int i = 1; i <= 6; i++) {
            LocalDateTime target = kst.plusHours(i);
            map.put("__FD" + i + "__", target.format(date));
            map.put("__FT" + i + "__", "%02d00".formatted(target.getHour()));
        }
        return map;
    }
}
