package com.airvision.backend.publicdata.odor;

import com.airvision.backend.publicdata.ExternalApiException;
import com.airvision.backend.publicdata.ExternalApiUnavailableException;
import com.airvision.backend.publicdata.FixtureLoader;
import com.airvision.backend.publicdata.OdorProperties;
import com.airvision.backend.publicdata.PublicDataProperties;
import com.airvision.backend.publicdata.PublicDataNotConfiguredException;
import com.airvision.backend.publicdata.ServiceKeys;
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
 * 인천환경공단 악취 측정 데이터 odcloud OpenAPI 클라이언트.
 * AirKoreaClient와 동일한 정책(Mock 자동, 1회 재시도, 키 비로깅)을 따른다.
 * odcloud는 인증 오류를 HTTP 401 + {"code":-401,"msg":...} JSON으로 반환한다.
 */
@Component
public class OdorClient {

    private static final Logger log = LoggerFactory.getLogger(OdorClient.class);

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final OdorProperties props;
    private final String serviceKey;
    private final boolean mock;

    @org.springframework.beans.factory.annotation.Autowired
    public OdorClient(OdorProperties props, PublicDataProperties publicDataProps) {
        this(props, publicDataProps, new ObjectMapper(), defaultRestClient(props.baseUrl()));
    }

    OdorClient(OdorProperties props, PublicDataProperties publicDataProps,
               ObjectMapper objectMapper, RestClient restClient) {
        this.props = props;
        this.restClient = restClient;
        this.objectMapper = objectMapper;
        this.serviceKey = ServiceKeys.normalize(props.serviceKey());
        this.mock = publicDataProps.mockActive(props.serviceKey());
        if (mock) {
            log.info("악취 데이터 클라이언트: Mock 모드로 동작 (서비스키 미설정 또는 강제 설정)");
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

    /** 사업소 데이터셋 1개의 측정 행 전체를 조회한다. */
    public List<Map<String, Object>> rows(OdorProperties.Dataset dataset) {
        String body = mock
                ? FixtureLoader.load("odor/raw/" + dataset.fixture(), Map.of())
                : getWithRetry(dataset.path());
        return parse(body, dataset.office());
    }

    private String getWithRetry(String path) {
        requireKey();
        int attempts = 0;
        while (true) {
            attempts++;
            try {
                return restClient.get()
                        .uri(builder -> builder.path(path)
                                .queryParam("page", 1)
                                .queryParam("perPage", props.perPage())
                                .queryParam("returnType", "JSON")
                                .queryParam("serviceKey", serviceKey)
                                .build())
                        .retrieve()
                        .body(String.class);
            } catch (HttpStatusCodeException e) {
                int code = e.getStatusCode().value();
                boolean retryable = code == 429 || code == 502 || code == 503 || code == 504;
                if (retryable && attempts < 2) {
                    continue;
                }
                if (code == 401) {
                    throw new ExternalApiException(
                            "악취 데이터 API 인증 실패 (HTTP 401) — 공공데이터포털에서 해당 데이터셋 활용신청 여부를 확인하세요");
                }
                throw new ExternalApiException("악취 데이터 API 오류 (HTTP %d)".formatted(code), e);
            } catch (RestClientException e) {
                if (attempts < 2) {
                    continue;
                }
                throw new ExternalApiUnavailableException(
                        "악취 데이터 API에 연결할 수 없습니다 (네트워크/타임아웃)", e);
            }
        }
    }

    private void requireKey() {
        if (serviceKey.isBlank()) {
            throw new PublicDataNotConfiguredException(
                    "악취 데이터 서비스키가 설정되지 않았습니다. .env의 ODOR_SERVICE_KEY를 입력하거나 "
                            + "PUBLIC_DATA_MOCK_ENABLED=true로 Mock 모드를 사용하세요");
        }
    }

    private List<Map<String, Object>> parse(String body, String office) {
        if (body == null || body.isBlank()) {
            throw new ExternalApiException("악취 데이터 API가 빈 응답을 반환했습니다 (" + office + ")");
        }
        try {
            OdorRaw.Envelope envelope = objectMapper.readValue(body.trim(), OdorRaw.Envelope.class);
            return envelope.data() == null ? List.of() : envelope.data();
        } catch (com.fasterxml.jackson.core.JacksonException e) {
            throw new ExternalApiException(
                    "악취 데이터 API 응답 형식을 해석할 수 없습니다 (" + office + ")", e);
        }
    }
}
