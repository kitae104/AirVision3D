package com.airvision.backend.publicdata.airkorea;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServiceUnavailable;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.airvision.backend.publicdata.AirKoreaProperties;
import com.airvision.backend.publicdata.ExternalApiException;
import com.airvision.backend.publicdata.PublicDataNotConfiguredException;
import com.airvision.backend.publicdata.PublicDataProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class AirKoreaClientTest {

    private static final String STATIONS_JSON = """
            {"response":{"header":{"resultCode":"00","resultMsg":"NORMAL_SERVICE."},
             "body":{"totalCount":1,"items":[
               {"stationName":"송도","addr":"인천 연수구","dmX":"37.38256","dmY":"126.65463",
                "mangName":"도시대기","item":"PM10, PM2.5","year":"2010"}]}}}
            """;

    private static PublicDataProperties publicDataProps(String mockEnabled) {
        return new PublicDataProperties(mockEnabled,
                new PublicDataProperties.Cache(1800, 86400, 3600, 1800, 1800),
                new PublicDataProperties.Comparison(5, 60));
    }

    private record Setup(AirKoreaClient client, MockRestServiceServer server) {
    }

    private static Setup realClient(String serviceKey) {
        RestClient.Builder builder = RestClient.builder().baseUrl("https://mock.test");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        AirKoreaProperties props = new AirKoreaProperties(serviceKey, "https://mock.test", "인천");
        AirKoreaClient client = new AirKoreaClient(props, publicDataProps("false"),
                new ObjectMapper(), builder.build(),
                Clock.fixed(Instant.parse("2026-07-18T05:00:00Z"), ZoneId.of("UTC")));
        return new Setup(client, server);
    }

    @Test
    void 정상_JSON_응답을_파싱한다() {
        Setup setup = realClient("test-key");
        setup.server().expect(requestTo(containsString("getMsrstnList")))
                .andRespond(withSuccess(STATIONS_JSON, MediaType.APPLICATION_JSON));

        List<AirKoreaRaw.StationItem> stations = setup.client().stations();

        assertThat(stations).hasSize(1);
        assertThat(stations.get(0).stationName()).isEqualTo("송도");
        assertThat(stations.get(0).dmX()).isEqualTo("37.38256");
        setup.server().verify();
    }

    @Test
    void 서비스키의_특수문자는_한_번만_URL_인코딩된다() {
        Setup setup = realClient("abc+def/ghi==");
        setup.server().expect(requestTo(containsString("serviceKey=abc%2Bdef%2Fghi%3D%3D")))
                .andRespond(withSuccess(STATIONS_JSON, MediaType.APPLICATION_JSON));

        setup.client().stations();
        setup.server().verify();
    }

    @Test
    void 인코딩된_키를_넣어도_이중_인코딩하지_않는다() {
        // 사용자가 "인코딩 키"(%2B 포함)를 넣은 경우 1회 디코드 후 재인코딩 → 동일 결과
        Setup setup = realClient("abc%2Bdef");
        setup.server().expect(requestTo(containsString("serviceKey=abc%2Bdef")))
                .andRespond(withSuccess(STATIONS_JSON, MediaType.APPLICATION_JSON));

        setup.client().stations();
        setup.server().verify();
    }

    @Test
    void resultCode가_00이_아니면_ExternalApiException이다() {
        Setup setup = realClient("test-key");
        setup.server().expect(requestTo(containsString("getCtprvnRltmMesureDnsty")))
                .andRespond(withSuccess("""
                        {"response":{"header":{"resultCode":"22",
                        "resultMsg":"LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR"},"body":null}}
                        """, MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> setup.client().realtime("인천"))
                .isInstanceOf(ExternalApiException.class)
                .hasMessageContaining("resultCode=22");
    }

    @Test
    void HTTP_200으로_오는_XML_인증오류를_감지한다() {
        Setup setup = realClient("wrong-key");
        setup.server().expect(requestTo(containsString("getMsrstnList")))
                .andRespond(withSuccess("""
                        <OpenAPI_ServiceResponse><cmmMsgHeader>
                        <returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg>
                        <returnReasonCode>30</returnReasonCode>
                        </cmmMsgHeader></OpenAPI_ServiceResponse>
                        """, MediaType.APPLICATION_XML));

        assertThatThrownBy(() -> setup.client().stations())
                .isInstanceOf(ExternalApiException.class)
                .hasMessageContaining("SERVICE_KEY_IS_NOT_REGISTERED_ERROR");
    }

    @Test
    void 결과_0건이면_빈_목록을_반환한다() {
        Setup setup = realClient("test-key");
        setup.server().expect(requestTo(containsString("getUlfptcaAlarmInfo")))
                .andRespond(withSuccess("""
                        {"response":{"header":{"resultCode":"00","resultMsg":"NORMAL_SERVICE."},
                         "body":{"totalCount":0,"items":[]}}}
                        """, MediaType.APPLICATION_JSON));

        assertThat(setup.client().alerts(2026)).isEmpty();
    }

    @Test
    void 일시적_503은_한_번_재시도한다() {
        Setup setup = realClient("test-key");
        setup.server().expect(requestTo(containsString("getMsrstnList")))
                .andRespond(withServiceUnavailable());
        setup.server().expect(requestTo(containsString("getMsrstnList")))
                .andRespond(withSuccess(STATIONS_JSON, MediaType.APPLICATION_JSON));

        assertThat(setup.client().stations()).hasSize(1);
        setup.server().verify();
    }

    @Test
    void 키_미설정에_Mock_비활성이면_설정_오류를_던진다() {
        Setup setup = realClient("");
        assertThatThrownBy(() -> setup.client().stations())
                .isInstanceOf(PublicDataNotConfiguredException.class)
                .hasMessageContaining("AIRKOREA_SERVICE_KEY");
    }

    @Test
    void Mock_모드는_fixture를_같은_파싱_경로로_반환하고_시각을_치환한다() {
        AirKoreaProperties props = new AirKoreaProperties("", "https://unused.test", "인천");
        AirKoreaClient client = new AirKoreaClient(props, publicDataProps("auto"),
                new ObjectMapper(), RestClient.builder().baseUrl("https://unused.test").build(),
                Clock.fixed(Instant.parse("2026-07-18T05:00:00Z"), ZoneId.of("UTC")));

        assertThat(client.isMock()).isTrue();
        assertThat(client.stations()).isNotEmpty();

        List<AirKoreaRaw.RealtimeItem> realtime = client.realtime("인천");
        assertThat(realtime).isNotEmpty();
        // __DATA_TIME__ 플레이스홀더가 KST(UTC 05시 = KST 14시) 기준으로 치환된다
        assertThat(realtime.get(0).dataTime()).isEqualTo("2026-07-18 14:00");
        // 통신장애 시나리오 포함 확인
        assertThat(realtime.stream().anyMatch(i -> "통신장애".equals(i.pm25Flag()))).isTrue();

        List<AirKoreaRaw.ForecastItem> forecast =
                client.forecast(LocalDate.parse("2026-07-18"), "PM25");
        assertThat(forecast).hasSize(3);
        assertThat(forecast.get(0).informData()).isEqualTo("2026-07-18");
    }
}
