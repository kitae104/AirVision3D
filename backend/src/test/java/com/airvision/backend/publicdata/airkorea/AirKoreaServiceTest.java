package com.airvision.backend.publicdata.airkorea;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.airvision.backend.common.NotFoundException;
import com.airvision.backend.publicdata.AirKoreaProperties;
import com.airvision.backend.publicdata.PublicDataProperties;
import com.airvision.backend.publicdata.airkorea.dto.CurrentAirQualityResponse;
import com.airvision.backend.publicdata.airkorea.dto.PublicStationResponse;
import com.airvision.backend.publicdata.airkorea.dto.StationAirQuality;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class AirKoreaServiceTest {

    private AirKoreaClient client;
    private AirKoreaService service;

    private static AirKoreaRaw.RealtimeItem realtimeItem(String station, String pm25,
                                                         String pm25Grade, String pm25Flag) {
        return new AirKoreaRaw.RealtimeItem("인천", station, "2026-07-18 14:00",
                "40", pm25, "0.03", "0.02", "0.5", "0.003", "80",
                "2", pm25Grade, "1", "1", "1", "1", "2",
                null, pm25Flag, null, null, null, null);
    }

    @BeforeEach
    void setUp() {
        client = mock(AirKoreaClient.class);
        AirKoreaProperties props = new AirKoreaProperties("", "https://unused", "인천");
        PublicDataProperties publicDataProps = new PublicDataProperties("auto",
                new PublicDataProperties.Cache(1800, 86400, 3600, 1800, 1800),
                new PublicDataProperties.Comparison(5, 60));
        service = new AirKoreaService(client, props, publicDataProps,
                Clock.fixed(Instant.parse("2026-07-18T05:00:00Z"), ZoneId.of("UTC")));

        when(client.isMock()).thenReturn(true);
        when(client.stations()).thenReturn(List.of(
                new AirKoreaRaw.StationItem("송도", "인천 연수구", "37.38256", "126.65463",
                        "도시대기", "PM10, PM2.5", "2010"),
                new AirKoreaRaw.StationItem("좌표없음소", "인천 남동구", "", "",
                        "도시대기", "PM10", "2020")));
    }

    @Test
    void 실시간_측정값에_측정소_좌표를_결합한다() {
        when(client.realtime(anyString())).thenReturn(List.of(
                realtimeItem("송도", "12", "1", null)));

        CurrentAirQualityResponse res = service.current("인천");

        assertThat(res.sido()).isEqualTo("인천");
        assertThat(res.stale()).isFalse();
        StationAirQuality songdo = res.stations().get(0);
        assertThat(songdo.latitude()).isEqualTo(37.38256);
        assertThat(songdo.locationAvailable()).isTrue();
        assertThat(songdo.pm25().value()).isEqualTo(12.0);
        assertThat(songdo.pm25().grade()).isEqualTo("좋음");
        assertThat(songdo.measuredAt()).isEqualTo(Instant.parse("2026-07-18T05:00:00Z"));
    }

    @Test
    void 좌표_없는_측정소는_locationAvailable_false로_표시한다() {
        when(client.realtime(anyString())).thenReturn(List.of(
                realtimeItem("좌표없음소", "20", "2", null)));

        StationAirQuality station = service.current(null).stations().get(0);

        assertThat(station.locationAvailable()).isFalse();
        assertThat(station.latitude()).isNull();
        assertThat(station.longitude()).isNull();
        assertThat(station.pm25().value()).isEqualTo(20.0);
    }

    @Test
    void 통신장애_측정소는_valid_false다() {
        when(client.realtime(anyString())).thenReturn(List.of(
                realtimeItem("송도", "-", null, "통신장애")));

        StationAirQuality station = service.current("인천").stations().get(0);

        assertThat(station.pm25().valid()).isFalse();
        assertThat(station.pm25().value()).isNull();
        assertThat(station.pm25().status()).isEqualTo(AirKoreaNormalizer.STATUS_COMM_ERROR);
    }

    @Test
    void 지원하지_않는_시도명은_400_계열_예외다() {
        assertThatThrownBy(() -> service.current("화성시"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void 없는_측정소_조회는_NotFound다() {
        when(client.realtime(anyString())).thenReturn(List.of(
                realtimeItem("송도", "12", "1", null)));

        assertThatThrownBy(() -> service.currentByStation("없는소", null))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void 근접_측정소는_거리순으로_반환하고_좌표없는_곳은_제외한다() {
        List<PublicStationResponse> nearby =
                service.nearbyStations(37.4, 126.7, 50);

        assertThat(nearby).hasSize(1);
        assertThat(nearby.get(0).stationName()).isEqualTo("송도");
        assertThat(nearby.get(0).distanceKm()).isNotNull();
    }

    @Test
    void 좌표_범위를_검증한다() {
        assertThatThrownBy(() -> service.nearbyStations(95, 126.7, 10))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.nearbyStations(37.4, 126.7, 0))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
