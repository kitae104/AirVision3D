package com.airvision.backend.publicdata.cctv;

import com.airvision.backend.publicdata.ExternalApiException;
import com.airvision.backend.publicdata.ExternalApiUnavailableException;
import com.airvision.backend.publicdata.FixtureLoader;
import com.airvision.backend.publicdata.ItsCctvProperties;
import com.airvision.backend.publicdata.PublicDataNotConfiguredException;
import com.airvision.backend.publicdata.PublicDataProperties;
import com.airvision.backend.publicdata.ServiceKeys;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
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
 * ITS 국가교통정보센터 실시간 도로 CCTV OpenAPI 클라이언트.
 * OdorClient와 동일한 정책(Mock 자동, 1회 재시도, 키 비로깅)을 따른다.
 * cctvType=1(실시간 스트리밍, HLS)만 조회한다.
 */
@Component
public class CctvClient {

    private static final Logger log = LoggerFactory.getLogger(CctvClient.class);

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final String serviceKey;
    private final boolean mock;

    @org.springframework.beans.factory.annotation.Autowired
    public CctvClient(ItsCctvProperties props, PublicDataProperties publicDataProps) {
        this(props, publicDataProps, defaultRestClient(props.baseUrl()));
    }

    CctvClient(ItsCctvProperties props, PublicDataProperties publicDataProps,
               RestClient restClient) {
        this.restClient = restClient;
        // 단일 항목 응답 시 data가 배열이 아닌 객체로 오는 경우를 흡수한다
        this.objectMapper = new ObjectMapper()
                .enable(DeserializationFeature.ACCEPT_SINGLE_VALUE_AS_ARRAY);
        this.serviceKey = ServiceKeys.normalize(props.serviceKey());
        this.mock = publicDataProps.mockActive(props.serviceKey());
        if (mock) {
            log.info("ITS CCTV 클라이언트: Mock 모드로 동작 (서비스키 미설정 또는 강제 설정)");
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

    /** 경위도 사각 범위 내 실시간 스트리밍(HLS) CCTV 목록. */
    public List<CctvRaw.Item> cctvs(double minX, double minY, double maxX, double maxY) {
        String body = mock
                ? FixtureLoader.load("cctv/raw/incheon.json", Map.of())
                : getWithRetry(minX, minY, maxX, maxY);
        return parse(body);
    }

    private String getWithRetry(double minX, double minY, double maxX, double maxY) {
        requireKey();
        int attempts = 0;
        while (true) {
            attempts++;
            try {
                return restClient.get()
                        .uri("/cctvInfo?apiKey={key}&type=its&cctvType=1"
                                        + "&minX={minX}&maxX={maxX}&minY={minY}&maxY={maxY}"
                                        + "&getType=json",
                                Map.of("key", serviceKey,
                                        "minX", String.valueOf(minX),
                                        "maxX", String.valueOf(maxX),
                                        "minY", String.valueOf(minY),
                                        "maxY", String.valueOf(maxY)))
                        .retrieve()
                        .body(String.class);
            } catch (HttpStatusCodeException e) {
                int code = e.getStatusCode().value();
                boolean retryable = code == 429 || code == 502 || code == 503 || code == 504;
                if (retryable && attempts < 2) {
                    continue;
                }
                throw new ExternalApiException("ITS CCTV API 오류 (HTTP %d)".formatted(code), e);
            } catch (RestClientException e) {
                if (attempts < 2) {
                    continue;
                }
                throw new ExternalApiUnavailableException(
                        "ITS CCTV API에 연결할 수 없습니다 (네트워크/타임아웃)", e);
            }
        }
    }

    private void requireKey() {
        if (serviceKey.isBlank()) {
            throw new PublicDataNotConfiguredException(
                    "ITS CCTV 서비스키가 설정되지 않았습니다. .env의 ITS_CCTV_KEY를 입력하거나 "
                            + "PUBLIC_DATA_MOCK_ENABLED=true로 Mock 모드를 사용하세요");
        }
    }

    private List<CctvRaw.Item> parse(String body) {
        if (body == null || body.isBlank()) {
            throw new ExternalApiException("ITS CCTV API가 빈 응답을 반환했습니다");
        }
        try {
            CctvRaw.Envelope envelope =
                    objectMapper.readValue(body.trim(), CctvRaw.Envelope.class);
            if (envelope.response() == null || envelope.response().data() == null) {
                return List.of();
            }
            return envelope.response().data();
        } catch (com.fasterxml.jackson.core.JacksonException e) {
            throw new ExternalApiException("ITS CCTV API 응답 형식을 해석할 수 없습니다", e);
        }
    }
}
