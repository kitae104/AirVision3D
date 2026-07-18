package com.airvision.backend.publicdata.kma;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.airvision.backend.publicdata.PublicDataProperties;
import com.airvision.backend.publicdata.airkorea.AirKoreaService;
import com.airvision.backend.publicdata.kma.dto.WeatherForecastResponse;
import com.airvision.backend.publicdata.kma.dto.WeatherNowResponse;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class KmaWeatherServiceTest {

    private KmaWeatherClient client;
    private KmaWeatherService service;

    private static KmaRaw.Item ncstItem(String category, String value) {
        return new KmaRaw.Item("20260718", "1400", category, 55, 124, value, null, null, null);
    }

    private static KmaRaw.Item fcstItem(String category, String fcstTime, String value) {
        return new KmaRaw.Item("20260718", "1330", category, 55, 124, null,
                "20260718", fcstTime, value);
    }

    @BeforeEach
    void setUp() {
        client = mock(KmaWeatherClient.class);
        when(client.isMock()).thenReturn(true);
        PublicDataProperties props = new PublicDataProperties("auto",
                new PublicDataProperties.Cache(1800, 86400, 3600, 1800, 1800),
                new PublicDataProperties.Comparison(5, 60));
        service = new KmaWeatherService(client, mock(AirKoreaService.class), props,
                Clock.fixed(Instant.parse("2026-07-18T05:50:00Z"), ZoneId.of("UTC")));
    }

    @Test
    void 초단기실황_카테고리를_피벗해_현재_기상을_만든다() {
        when(client.ultraNcst(any(), anyInt(), anyInt())).thenReturn(List.of(
                ncstItem("T1H", "27.3"), ncstItem("REH", "64"), ncstItem("RN1", "0"),
                ncstItem("PTY", "0"), ncstItem("VEC", "315"), ncstItem("WSD", "2.4")));

        WeatherNowResponse now = service.current(37.4563, 126.7052);

        assertThat(now.gridX()).isEqualTo(55);
        assertThat(now.gridY()).isEqualTo(124);
        assertThat(now.temperature()).isEqualTo(27.3);
        assertThat(now.humidity()).isEqualTo(64);
        assertThat(now.precipitationType()).isEqualTo("없음");
        assertThat(now.windSpeed()).isEqualTo(2.4);
        assertThat(now.windDirectionDegree()).isEqualTo(315);
        assertThat(now.windDirectionText()).isEqualTo("북서풍");
        // 기상학적 풍향 315(불어오는 방향) → 화살표(이동 방향) 135
        assertThat(now.windArrowDegree()).isEqualTo(135);
        assertThat(now.source()).isEqualTo("KMA");
    }

    @Test
    void 결측값_900이상은_null로_처리한다() {
        when(client.ultraNcst(any(), anyInt(), anyInt())).thenReturn(List.of(
                ncstItem("T1H", "-999"), ncstItem("REH", "902"), ncstItem("WSD", "2.0")));

        WeatherNowResponse now = service.current(37.4563, 126.7052);

        assertThat(now.temperature()).isNull();
        assertThat(now.humidity()).isNull();
        assertThat(now.windSpeed()).isEqualTo(2.0);
        assertThat(now.windDirectionDegree()).isNull();
        assertThat(now.windDirectionText()).isNull();
    }

    @Test
    void 초단기예보를_시각별로_피벗하고_시간순으로_정렬한다() {
        when(client.ultraFcst(any(), anyInt(), anyInt())).thenReturn(List.of(
                fcstItem("T1H", "1600", "26.5"), fcstItem("SKY", "1600", "3"),
                fcstItem("PTY", "1600", "0"),
                fcstItem("T1H", "1500", "27.0"), fcstItem("SKY", "1500", "1"),
                fcstItem("PTY", "1500", "1")));

        WeatherForecastResponse forecast = service.forecast(37.4563, 126.7052);

        assertThat(forecast.hours()).hasSize(2);
        assertThat(forecast.hours().get(0).temperature()).isEqualTo(27.0);
        assertThat(forecast.hours().get(0).sky()).isEqualTo("맑음");
        assertThat(forecast.hours().get(0).precipitationType()).isEqualTo("비");
        assertThat(forecast.hours().get(1).sky()).isEqualTo("구름많음");
        assertThat(forecast.hours().get(0).forecastAt())
                .isBefore(forecast.hours().get(1).forecastAt());
    }

    @Test
    void 강수없음_같은_문자열_예보값은_null로_처리한다() {
        assertThat(KmaWeatherService.parseValue("강수없음")).isNull();
        assertThat(KmaWeatherService.parseValue("1mm 미만")).isNull();
        assertThat(KmaWeatherService.parseValue("2.5")).isEqualTo(2.5);
        assertThat(KmaWeatherService.parseValue(null)).isNull();
    }
}
