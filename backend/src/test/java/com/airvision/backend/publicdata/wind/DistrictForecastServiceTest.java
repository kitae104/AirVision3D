package com.airvision.backend.publicdata.wind;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.airvision.backend.publicdata.airkorea.AirKoreaService;
import com.airvision.backend.publicdata.airkorea.dto.CurrentAirQualityResponse;
import com.airvision.backend.publicdata.airkorea.dto.PollutantValue;
import com.airvision.backend.publicdata.airkorea.dto.StationAirQuality;
import com.airvision.backend.publicdata.wind.dto.AdvectionResponse;
import com.airvision.backend.publicdata.wind.dto.DistrictForecastResponse;
import com.airvision.backend.publicdata.wind.dto.WindFieldResponse;
import java.time.Instant;
import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class DistrictForecastServiceTest {

    private static final WindFieldResponse.Bounds BOUNDS =
            new WindFieldResponse.Bounds(126.0, 37.0, 127.0, 38.0);
    private static final int W = 5;
    private static final int H = 5;

    private WindFieldService windFieldService;
    private AdvectionService advectionService;
    private AirKoreaService airKoreaService;
    private DistrictForecastService service;

    @BeforeEach
    void setUp() {
        windFieldService = mock(WindFieldService.class);
        advectionService = mock(AdvectionService.class);
        airKoreaService = mock(AirKoreaService.class);
        service = new DistrictForecastService(windFieldService, advectionService,
                airKoreaService);
    }

    private void givenWestWindAndUniformFrames() {
        // 서풍 3 m/s (u=+3, v=0) 균일 바람장, 1시간 예보
        List<Double> u = Collections.nCopies(W * H, 3.0);
        List<Double> v = Collections.nCopies(W * H, 0.0);
        when(windFieldService.field()).thenReturn(new WindFieldResponse(
                BOUNDS, W, H, Instant.parse("2026-07-18T05:30:00Z"), "KMA", true, false,
                List.of(new WindFieldResponse.HourField(
                        Instant.parse("2026-07-18T06:00:00Z"), u, v, 3.0, 3.0))));
        // 이류 프레임: pm25=20, pm10=40 균일 3프레임
        List<Double> pm25 = Collections.nCopies(W * H, 20.0);
        List<Double> pm10 = Collections.nCopies(W * H, 40.0);
        when(advectionService.advect(anyInt())).thenReturn(new AdvectionResponse(
                BOUNDS, W, H, "advection-only", true, List.of(
                new AdvectionResponse.Frame(Instant.parse("2026-07-18T06:00:00Z"), pm25, pm10),
                new AdvectionResponse.Frame(Instant.parse("2026-07-18T07:00:00Z"), pm25, pm10),
                new AdvectionResponse.Frame(Instant.parse("2026-07-18T08:00:00Z"), pm25, pm10))));
        when(airKoreaService.current(anyString())).thenReturn(new CurrentAirQualityResponse(
                "인천", "AirKorea", true, false, Instant.parse("2026-07-18T05:00:00Z"), null,
                List.of(station(37.46, 126.665, 30.0, 60.0),
                        station(37.435, 126.72, 50.0, 80.0))));
    }

    @Test
    void 핵심_3구의_현재_추정치와_시간별_예측을_반환한다() {
        givenWestWindAndUniformFrames();

        DistrictForecastResponse response = service.forecast(3);

        assertThat(response.current()).extracting(DistrictForecastResponse.DistrictNow::district)
                .containsExactly("미추홀구", "남동구", "연수구");
        // 미추홀구 중심 = 측정소 좌표와 동일 → IDW가 실측값 그대로
        assertThat(response.current().get(0).pm25()).isEqualTo(30.0);
        assertThat(response.current().get(0).pm10()).isEqualTo(60.0);
        assertThat(response.hourly()).hasSize(3);
        assertThat(response.hourly().get(0).districts()).hasSize(3);
        assertThat(response.hourly().get(0).districts().get(0).pm25()).isEqualTo(20.0);
        assertThat(response.hourly().get(0).districts().get(0).pm10()).isEqualTo(40.0);
        assertThat(response.model()).isEqualTo("advection-only");
        assertThat(response.mock()).isTrue();
    }

    @Test
    void 서풍이면_풍향은_서풍_이동은_동쪽이다() {
        givenWestWindAndUniformFrames();

        DistrictForecastResponse response = service.forecast(1);

        DistrictForecastResponse.WindVector wind = response.current().get(0).wind();
        assertThat(wind.speedMs()).isCloseTo(3.0, org.assertj.core.data.Offset.offset(1e-6));
        assertThat(wind.directionDeg()).isCloseTo(270.0, org.assertj.core.data.Offset.offset(0.01));
        assertThat(wind.directionText()).isEqualTo("서풍");
        assertThat(wind.movementText()).contains("동");
        assertThat(response.hourly().get(0).districts().get(0).wind().directionText())
                .isEqualTo("서풍");
    }

    @Test
    void 무풍이면_정체로_표시한다() {
        List<Double> zero = Collections.nCopies(W * H, 0.0);
        when(windFieldService.field()).thenReturn(new WindFieldResponse(
                BOUNDS, W, H, Instant.parse("2026-07-18T05:30:00Z"), "KMA", true, false,
                List.of(new WindFieldResponse.HourField(
                        Instant.parse("2026-07-18T06:00:00Z"), zero, zero, 0, 0))));
        List<Double> pm25 = Collections.nCopies(W * H, 20.0);
        when(advectionService.advect(anyInt())).thenReturn(new AdvectionResponse(
                BOUNDS, W, H, "advection-only", true, List.of(
                new AdvectionResponse.Frame(Instant.parse("2026-07-18T06:00:00Z"), pm25, null))));
        when(airKoreaService.current(anyString())).thenReturn(new CurrentAirQualityResponse(
                "인천", "AirKorea", true, false, Instant.parse("2026-07-18T05:00:00Z"), null,
                List.of(station(37.46, 126.665, 30.0, null))));

        DistrictForecastResponse response = service.forecast(1);

        assertThat(response.current().get(0).wind().directionText()).isEqualTo("무풍");
        assertThat(response.current().get(0).wind().movementText()).isEqualTo("정체");
        assertThat(response.current().get(0).pm10()).isNull();
        assertThat(response.hourly().get(0).districts().get(0).pm10()).isNull();
    }

    @Test
    void hours_범위를_검증한다() {
        assertThatThrownBy(() -> service.forecast(0))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.forecast(7))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private static StationAirQuality station(double lat, double lon,
                                             Double pm25, Double pm10) {
        return new StationAirQuality("측정소", "인천", lat, lon, true,
                Instant.parse("2026-07-18T05:00:00Z"),
                pollutant(pm10), pollutant(pm25), null, null, null, null, null);
    }

    private static PollutantValue pollutant(Double value) {
        return value == null
                ? new PollutantValue(null, "㎍/㎥", null, false, "NO_DATA")
                : new PollutantValue(value, "㎍/㎥", "좋음", true, "OK");
    }
}
