package com.airvision.backend.publicdata.odor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.airvision.backend.publicdata.ExternalApiException;
import com.airvision.backend.publicdata.OdorProperties;
import com.airvision.backend.publicdata.odor.dto.OdorResponse;
import com.airvision.backend.publicdata.odor.dto.OdorSpotResponse;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** 지점 단위 집계(최신값·최대값·건수)와 사업소 단위 장애 격리를 확인한다 (클라이언트는 mock). */
class OdorServiceTest {

    private OdorClient client;
    private OdorProperties props;
    private OdorService service;

    private static final OdorProperties.Dataset GAJWA =
            new OdorProperties.Dataset("가좌사업소", "/g", "gajwa.json");
    private static final OdorProperties.Dataset SEUNGGI =
            new OdorProperties.Dataset("승기사업소", "/s", "seunggi.json");

    @BeforeEach
    void setUp() {
        client = mock(OdorClient.class);
        props = new OdorProperties("", "https://api.odcloud.kr/api", 86400, 500,
                List.of(GAJWA, SEUNGGI));
        service = new OdorService(client, props);
    }

    @Test
    void measurements_aggregatesPerSpot_latestAndMax() {
        when(client.rows(GAJWA)).thenReturn(List.of(
                Map.of("측정지점", "정문", "측정일자", "2026-05-14", "측정값(복합악취희석배수)", 6.7,
                        "좌표_위도_Y축", 37.4862, "좌표_경도_X축", 126.6758),
                Map.of("측정지점", "정문", "측정일자", "2026-06-11", "측정값(복합악취희석배수)", 10.0,
                        "좌표_위도_Y축", 37.4862, "좌표_경도_X축", 126.6758),
                Map.of("측정지점", "북측 경계", "측정일자", "2026-06-11", "측정값(복합악취희석배수)", 20.8,
                        "좌표_위도_Y축", 37.4838, "좌표_경도_X축", 126.6701)));
        when(client.rows(SEUNGGI)).thenReturn(List.of());

        OdorResponse response = service.measurements();

        assertThat(response.failedOffices()).isEmpty();
        assertThat(response.spotCount()).isEqualTo(2);
        OdorSpotResponse gate = response.spots().stream()
                .filter(s -> "정문".equals(s.spotName())).findFirst().orElseThrow();
        assertThat(gate.latestDate()).isEqualTo("2026-06-11");
        assertThat(gate.latestDilution()).isEqualTo(10.0);
        assertThat(gate.maxDilution()).isEqualTo(10.0);
        assertThat(gate.measurementCount()).isEqualTo(2);
        assertThat(gate.locationAvailable()).isTrue();
    }

    @Test
    void measurements_officeFailure_isIsolated() {
        when(client.rows(GAJWA)).thenThrow(new ExternalApiException("HTTP 401"));
        when(client.rows(SEUNGGI)).thenReturn(List.of(
                Map.of("측정장소", "정문", "측정일자", "2026-06-17", "측정값(복합악취희석배수)", 12.5)));

        OdorResponse response = service.measurements();

        assertThat(response.failedOffices()).containsExactly("가좌사업소");
        assertThat(response.spotCount()).isEqualTo(1);
        assertThat(response.spots().get(0).office()).isEqualTo("승기사업소");
        assertThat(response.spots().get(0).locationAvailable()).isFalse();
    }

    @Test
    void measurements_spotWithoutNameUsesAddress_andSortsByDilutionDesc() {
        when(client.rows(GAJWA)).thenReturn(List.of(
                Map.of("주소_위치정보", "인천 서구 가좌동 1", "측정일자", "2026-06-11",
                        "측정값(복합악취희석배수)", 3.0),
                Map.of("측정지점", "높은 지점", "측정일자", "2026-06-11",
                        "측정값(복합악취희석배수)", 18.0)));
        when(client.rows(SEUNGGI)).thenReturn(List.of());

        OdorResponse response = service.measurements();

        assertThat(response.spots()).extracting(OdorSpotResponse::spotName)
                .containsExactly("높은 지점", "인천 서구 가좌동 1");
    }

    @Test
    void measurements_cachesPerOffice() {
        when(client.rows(GAJWA)).thenReturn(List.of(
                Map.of("측정지점", "정문", "측정일자", "2026-06-11", "측정값(복합악취희석배수)", 10.0)));
        when(client.rows(SEUNGGI)).thenReturn(List.of());

        service.measurements();
        service.measurements();

        org.mockito.Mockito.verify(client, org.mockito.Mockito.times(1)).rows(GAJWA);
    }
}
