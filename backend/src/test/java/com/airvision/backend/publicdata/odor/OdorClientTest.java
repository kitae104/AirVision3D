package com.airvision.backend.publicdata.odor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withUnauthorizedRequest;

import com.airvision.backend.publicdata.ExternalApiException;
import com.airvision.backend.publicdata.OdorProperties;
import com.airvision.backend.publicdata.PublicDataProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class OdorClientTest {

    private static final String ROWS_JSON = """
            {"page":1,"perPage":500,"totalCount":1,"currentCount":1,"matchCount":1,
             "data":[{"관할사업소":"승기사업소","측정지점":"방류구",
                      "측정값(복합악취희석배수)":"3.6","측정일자":"2023-01-25"}]}
            """;

    private static final OdorProperties.Dataset DATASET =
            new OdorProperties.Dataset("승기사업소", "/15105071/v1/uddi:test", "seunggi.json");

    private static PublicDataProperties publicDataProps() {
        return new PublicDataProperties("false",
                new PublicDataProperties.Cache(1800, 86400, 3600, 1800, 1800),
                new PublicDataProperties.Comparison(5, 60));
    }

    private record Setup(OdorClient client, MockRestServiceServer server) {
    }

    private static Setup realClient(String serviceKey) {
        RestClient.Builder builder = RestClient.builder().baseUrl("https://mock.test");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        OdorProperties props = new OdorProperties(serviceKey, "https://mock.test", 86400, 500,
                List.of(DATASET));
        OdorClient client = new OdorClient(props, publicDataProps(),
                new ObjectMapper(), builder.build());
        return new Setup(client, server);
    }

    @Test
    void 정상_JSON_응답을_파싱한다() {
        Setup setup = realClient("test-key");
        setup.server().expect(requestTo(containsString("uddi:test")))
                .andRespond(withSuccess(ROWS_JSON, MediaType.APPLICATION_JSON));

        List<Map<String, Object>> rows = setup.client().rows(DATASET);

        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).get("측정지점")).isEqualTo("방류구");
        setup.server().verify();
    }

    @Test
    void 서비스키의_특수문자는_엄격하게_URL_인코딩된다() {
        // 실제 발생한 결함의 회귀 테스트: '+'가 인코딩되지 않으면 odcloud가 공백으로 해석해
        // "등록되지 않은 인증키" 오류(HTTP 401)를 반환한다 (2026-07-23 실키 검증 중 발견)
        Setup setup = realClient("abc+def/ghi==");
        setup.server().expect(requestTo(containsString("serviceKey=abc%2Bdef%2Fghi%3D%3D")))
                .andRespond(withSuccess(ROWS_JSON, MediaType.APPLICATION_JSON));

        setup.client().rows(DATASET);

        setup.server().verify();
    }

    @Test
    void 인증_실패_401은_활용신청_안내_메시지를_담는다() {
        Setup setup = realClient("test-key");
        setup.server().expect(requestTo(containsString("uddi:test")))
                .andRespond(withUnauthorizedRequest());

        assertThatThrownBy(() -> setup.client().rows(DATASET))
                .isInstanceOf(ExternalApiException.class)
                .hasMessageContaining("활용신청");
    }
}
