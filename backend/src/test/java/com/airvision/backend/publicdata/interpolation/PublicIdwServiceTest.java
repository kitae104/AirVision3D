package com.airvision.backend.publicdata.interpolation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.airvision.backend.dashboard.GradeProperties;
import com.airvision.backend.publicdata.airkorea.AirKoreaService;
import com.airvision.backend.publicdata.airkorea.dto.CurrentAirQualityResponse;
import com.airvision.backend.publicdata.airkorea.dto.PollutantValue;
import com.airvision.backend.publicdata.airkorea.dto.StationAirQuality;
import com.airvision.backend.publicdata.interpolation.dto.IdwGridResponse;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class PublicIdwServiceTest {

    private AirKoreaService airKoreaService;
    private PublicIdwService service;

    private static PollutantValue pm25(Double value, boolean valid) {
        return new PollutantValue(value, "µg/m³", valid ? "보통" : null, valid,
                valid ? "NORMAL" : "NO_DATA");
    }

    private static StationAirQuality station(String name, Double lat, Double lon,
                                             boolean locAvail, Double pm25Value, boolean valid) {
        PollutantValue v = pm25(pm25Value, valid);
        return new StationAirQuality(name, "인천", lat, lon, locAvail, Instant.now(),
                v, v, v, v, v, v, v);
    }

    private void givenStations(StationAirQuality... stations) {
        when(airKoreaService.current(any())).thenReturn(new CurrentAirQualityResponse(
                "인천", "AIRKOREA", true, false, Instant.now(), null, List.of(stations)));
    }

    @BeforeEach
    void setUp() {
        airKoreaService = mock(AirKoreaService.class);
        GradeProperties grades = new GradeProperties(List.of(
                new GradeProperties.Grade("좋음", 15.0),
                new GradeProperties.Grade("보통", 35.0),
                new GradeProperties.Grade("나쁨", 75.0),
                new GradeProperties.Grade("매우나쁨", null)));
        service = new PublicIdwService(airKoreaService, grades);
    }

    @Test
    void 격자는_resolution_제곱개_셀을_만들고_소스수를_보고한다() {
        givenStations(
                station("송도", 37.38, 126.65, true, 12.0, true),
                station("부평", 37.50, 126.72, true, 40.0, true),
                station("검단", 37.60, 126.68, true, 25.0, true));

        IdwGridResponse res = service.grid("인천", 2.0, 10);

        assertThat(res.resolution()).isEqualTo(10);
        assertThat(res.cells()).hasSize(100);
        assertThat(res.sourceCount()).isEqualTo(3);
        assertThat(res.source()).isEqualTo("AIRKOREA");
        // 모든 셀이 bbox 안에 있다
        assertThat(res.cells()).allSatisfy(c -> {
            assertThat(c.latitude()).isBetween(res.bbox().minLatitude(), res.bbox().maxLatitude());
            assertThat(c.longitude()).isBetween(res.bbox().minLongitude(), res.bbox().maxLongitude());
        });
    }

    @Test
    void 무좌표_및_무효_pm25_측정소는_소스에서_제외한다() {
        givenStations(
                station("정상", 37.4, 126.7, true, 20.0, true),
                station("좌표없음", null, null, false, 30.0, true),
                station("통신장애", 37.5, 126.7, true, null, false));

        IdwGridResponse res = service.grid("인천", 2.0, 8);

        assertThat(res.sourceCount()).isEqualTo(1);
    }

    @Test
    void 유효_소스가_없으면_예외다() {
        givenStations(station("통신장애", 37.5, 126.7, true, null, false));

        assertThatThrownBy(() -> service.grid("인천", 2.0, 8))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void 단일_소스면_모든_셀이_그_값이다() {
        givenStations(station("송도", 37.4, 126.7, true, 33.0, true));

        IdwGridResponse res = service.grid("인천", 2.0, 6);

        // IDW 소스가 1곳이면 가중평균은 항상 그 값 (IdwInterpolator 위임)
        assertThat(res.cells()).allSatisfy(c -> assertThat(c.pm25()).isEqualTo(33.0));
        assertThat(res.cells().get(0).grade()).isEqualTo("보통");
    }

    @Test
    void power와_resolution_범위를_검증하고_null이면_기본값을_쓴다() {
        givenStations(station("송도", 37.4, 126.7, true, 20.0, true));

        assertThatThrownBy(() -> service.grid("인천", 0.0, 8))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.grid("인천", 2.0, 1))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.grid("인천", 2.0, 21))
                .isInstanceOf(IllegalArgumentException.class);

        IdwGridResponse res = service.grid("인천", null, null);
        assertThat(res.power()).isEqualTo(2.0);
        assertThat(res.resolution()).isEqualTo(12);
        assertThat(res.cells()).hasSize(144);
    }

    @Test
    void power_resolution_경계값은_허용된다() {
        givenStations(station("송도", 37.4, 126.7, true, 20.0, true));

        assertThat(service.grid("인천", 0.1, 2).cells()).hasSize(4);
        assertThat(service.grid("인천", 10.0, 20).cells()).hasSize(400);
    }

    @Test
    void 소스_한_점이면_bbox가_최소_여백만큼_확장된다() {
        givenStations(station("송도", 37.4, 126.7, true, 20.0, true));

        IdwGridResponse res = service.grid("인천", 2.0, 4);

        // span=0이므로 위경도 모두 MIN_MARGIN_DEG(0.05)씩 양방향 확장
        assertThat(res.bbox().minLatitude()).isEqualTo(37.4 - 0.05);
        assertThat(res.bbox().maxLatitude()).isEqualTo(37.4 + 0.05);
        assertThat(res.bbox().minLongitude()).isEqualTo(126.7 - 0.05);
        assertThat(res.bbox().maxLongitude()).isEqualTo(126.7 + 0.05);
    }
}
