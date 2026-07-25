package com.airvision.backend.publicdata.wind;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.airvision.backend.publicdata.airkorea.AirKoreaService;
import com.airvision.backend.publicdata.airkorea.dto.CurrentAirQualityResponse;
import com.airvision.backend.publicdata.airkorea.dto.PollutantValue;
import com.airvision.backend.publicdata.airkorea.dto.StationAirQuality;
import com.airvision.backend.publicdata.wind.dto.AdvectionResponse;
import com.airvision.backend.publicdata.wind.dto.WindFieldResponse;
import java.time.Instant;
import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.Test;

class AdvectionServiceTest {

    /** 5×5, 경도 1도 폭 격자. 셀 폭 ≈ 17.7km, u=5m/s(동진)면 1시간에 약 1셀 이동. */
    private static final WindFieldResponse.Bounds BOUNDS =
            new WindFieldResponse.Bounds(126.0, 37.0, 127.0, 38.0);

    @Test
    void 서풍장에서_농도_피크가_동쪽으로_이동한다() {
        int w = 5;
        int h = 5;
        double[] field = new double[w * h];
        field[2 * w + 2] = 100.0; // 중앙(row2, col2) 피크
        List<Double> u = Collections.nCopies(w * h, 5.0); // 서풍(동쪽으로 이동)
        List<Double> v = Collections.nCopies(w * h, 0.0);

        double[] next = AdvectionService.advectStep(field, u, v, w, h, BOUNDS);

        // 피크가 col3 쪽으로 이동: (2,3)이 커지고 (2,1)은 거의 0
        assertThat(next[2 * w + 3]).isGreaterThan(50.0);
        assertThat(next[2 * w + 1]).isLessThan(5.0);
    }

    @Test
    void 무풍이면_농도장이_유지된다() {
        int w = 5;
        int h = 5;
        double[] field = new double[w * h];
        field[12] = 42.0;
        List<Double> zero = Collections.nCopies(w * h, 0.0);

        double[] next = AdvectionService.advectStep(field, zero, zero, w, h, BOUNDS);

        assertThat(next[12]).isCloseTo(42.0, org.assertj.core.data.Offset.offset(1e-6));
    }

    @Test
    void 도메인_밖_역추적은_경계값으로_클램프된다() {
        int w = 5;
        int h = 5;
        double[] field = new double[w * h];
        for (int col = 0; col < w; col++) {
            field[0 * w + col] = 10.0; // 남쪽 경계 행만 10
        }
        // 강한 북진(v=+50m/s): 남쪽 밖에서 유입 → 남쪽 경계값 유지
        List<Double> u = Collections.nCopies(w * h, 0.0);
        List<Double> v = Collections.nCopies(w * h, 50.0);

        double[] next = AdvectionService.advectStep(field, u, v, w, h, BOUNDS);

        assertThat(next[0 * w + 2]).isCloseTo(10.0, org.assertj.core.data.Offset.offset(1e-6));
    }

    @Test
    void hours_범위를_검증한다() {
        AdvectionService service = new AdvectionService(null, null);
        assertThatThrownBy(() -> service.advect(0)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.advect(7)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void 실측_기반_PM25와_PM10_프레임을_함께_생성한다() {
        WindFieldService windFieldService = mock(WindFieldService.class);
        AirKoreaService airKoreaService = mock(AirKoreaService.class);
        int w = 5;
        int h = 5;
        List<Double> calm = Collections.nCopies(w * h, 0.0);
        when(windFieldService.field()).thenReturn(new WindFieldResponse(
                BOUNDS, w, h, Instant.parse("2026-07-18T05:30:00Z"), "KMA", true, false,
                List.of(new WindFieldResponse.HourField(
                        Instant.parse("2026-07-18T06:00:00Z"), calm, calm, 0, 0))));
        when(airKoreaService.current(anyString())).thenReturn(current(
                station(37.5, 126.5, 30.0, 55.0)));

        AdvectionResponse response =
                new AdvectionService(windFieldService, airKoreaService).advect(1);

        assertThat(response.frames()).hasSize(1);
        AdvectionResponse.Frame frame = response.frames().get(0);
        assertThat(frame.pm25()).hasSize(w * h);
        assertThat(frame.pm10()).hasSize(w * h);
        // 무풍 + 단일 관측점 → IDW 결과가 관측값으로 균일
        assertThat(frame.pm25().get(12)).isCloseTo(30.0, org.assertj.core.data.Offset.offset(0.11));
        assertThat(frame.pm10().get(12)).isCloseTo(55.0, org.assertj.core.data.Offset.offset(0.11));
        assertThat(response.model()).isEqualTo("advection-only");
    }

    @Test
    void 유효한_PM10_지점이_없으면_pm10_프레임은_null이다() {
        WindFieldService windFieldService = mock(WindFieldService.class);
        AirKoreaService airKoreaService = mock(AirKoreaService.class);
        int w = 5;
        int h = 5;
        List<Double> calm = Collections.nCopies(w * h, 0.0);
        when(windFieldService.field()).thenReturn(new WindFieldResponse(
                BOUNDS, w, h, Instant.parse("2026-07-18T05:30:00Z"), "KMA", true, false,
                List.of(new WindFieldResponse.HourField(
                        Instant.parse("2026-07-18T06:00:00Z"), calm, calm, 0, 0))));
        when(airKoreaService.current(anyString())).thenReturn(current(
                station(37.5, 126.5, 30.0, null)));

        AdvectionResponse response =
                new AdvectionService(windFieldService, airKoreaService).advect(1);

        assertThat(response.frames().get(0).pm25()).hasSize(w * h);
        assertThat(response.frames().get(0).pm10()).isNull();
    }

    @Test
    void 일부_시도_조회가_실패해도_나머지_시도_실측으로_예측한다() {
        WindFieldService windFieldService = mock(WindFieldService.class);
        AirKoreaService airKoreaService = mock(AirKoreaService.class);
        int w = 5;
        int h = 5;
        List<Double> calm = Collections.nCopies(w * h, 0.0);
        when(windFieldService.field()).thenReturn(new WindFieldResponse(
                BOUNDS, w, h, Instant.parse("2026-07-18T05:30:00Z"), "KMA", true, false,
                List.of(new WindFieldResponse.HourField(
                        Instant.parse("2026-07-18T06:00:00Z"), calm, calm, 0, 0))));
        // 서울만 성공하고 나머지 시도(인천·경기·강원·충북·충남)는 모두 실패
        when(airKoreaService.current(anyString()))
                .thenThrow(new IllegalStateException("시도 조회 실패"));
        when(airKoreaService.current(org.mockito.ArgumentMatchers.eq("서울")))
                .thenReturn(current(station(37.5, 126.5, 30.0, 55.0)));

        AdvectionResponse response =
                new AdvectionService(windFieldService, airKoreaService).advect(1);

        assertThat(response.frames()).hasSize(1);
        assertThat(response.frames().get(0).pm25().get(12))
                .isCloseTo(30.0, org.assertj.core.data.Offset.offset(0.11));
    }

    @Test
    void 모든_시도_조회가_실패하면_오류를_전파한다() {
        WindFieldService windFieldService = mock(WindFieldService.class);
        AirKoreaService airKoreaService = mock(AirKoreaService.class);
        List<Double> calm = Collections.nCopies(25, 0.0);
        when(windFieldService.field()).thenReturn(new WindFieldResponse(
                BOUNDS, 5, 5, Instant.parse("2026-07-18T05:30:00Z"), "KMA", true, false,
                List.of(new WindFieldResponse.HourField(
                        Instant.parse("2026-07-18T06:00:00Z"), calm, calm, 0, 0))));
        when(airKoreaService.current(anyString()))
                .thenThrow(new IllegalStateException("전체 장애"));

        assertThatThrownBy(() ->
                new AdvectionService(windFieldService, airKoreaService).advect(1))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("전체 장애");
    }

    private static CurrentAirQualityResponse current(StationAirQuality... stations) {
        return new CurrentAirQualityResponse("인천", "AirKorea", true, false,
                Instant.parse("2026-07-18T05:00:00Z"), null, List.of(stations));
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
