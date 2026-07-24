package com.airvision.backend.prediction;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.airvision.backend.ai.AiServiceClient;
import com.airvision.backend.prediction.dto.CctvEstimateResponse;
import com.airvision.backend.publicdata.airkorea.AirKoreaService;
import com.airvision.backend.publicdata.airkorea.dto.CurrentAirQualityResponse;
import com.airvision.backend.publicdata.airkorea.dto.PollutantValue;
import com.airvision.backend.publicdata.airkorea.dto.StationAirQuality;
import com.airvision.backend.publicdata.kma.KmaWeatherService;
import com.airvision.backend.publicdata.kma.dto.WeatherNowResponse;
import com.airvision.backend.dashboard.GradeProperties;
import com.airvision.backend.site.ObservationSite;
import com.airvision.backend.site.SiteService;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class CctvEstimateServiceTest {

    /** 인천 기준 낮(12:00 KST, 태양고도 약 +72도) / 밤(00:00 KST, 약 -31도). */
    private static final Instant DAY = Instant.parse("2026-07-18T03:00:00Z");
    private static final Instant NIGHT = Instant.parse("2026-07-18T15:00:00Z");

    private AiServiceClient aiClient;
    private SiteService siteService;
    private AirKoreaService airKoreaService;
    private KmaWeatherService kmaWeatherService;
    private GradeProperties gradeProperties;
    private MockMultipartFile image;

    @BeforeEach
    void setUp() {
        aiClient = mock(AiServiceClient.class);
        siteService = mock(SiteService.class);
        airKoreaService = mock(AirKoreaService.class);
        kmaWeatherService = mock(KmaWeatherService.class);
        gradeProperties = new GradeProperties(List.of(
                new GradeProperties.Grade("좋음", 15.0),
                new GradeProperties.Grade("보통", 35.0),
                new GradeProperties.Grade("나쁨", 75.0),
                new GradeProperties.Grade("매우나쁨", null)));
        image = new MockMultipartFile("image", "cctv.png", "image/png", new byte[]{1});
        when(siteService.getSiteOrThrow(1L)).thenReturn(new ObservationSite(
                "미추홀CCTV", 37.46, 126.665, null, "CCTV", null));
        when(airKoreaService.current(anyString())).thenReturn(current(
                station("주안", 37.4646, 126.68, 20.0, 40.0)));
    }

    private CctvEstimateService service(Instant now) {
        return new CctvEstimateService(aiClient, siteService, airKoreaService,
                kmaWeatherService, gradeProperties, Clock.fixed(now, ZoneId.of("UTC")));
    }

    @Test
    void 주간에는_AI_이미지_추론을_사용하고_PM10은_실측_비율로_추정한다() {
        when(kmaWeatherService.current(anyDouble(), anyDouble())).thenReturn(
                weatherNow(2.5));
        when(aiClient.predict(anyString(), any(), anyDouble(), anyDouble(), anyDouble(),
                any(), any(), any()))
                .thenReturn(new AiServiceClient.PredictData(80.0, "매우나쁨", "test_model"));

        CctvEstimateResponse response = service(DAY)
                .estimate(1L, "test_model", image, 28.0, 60.0);

        assertThat(response.mode()).isEqualTo("AI_IMAGE");
        assertThat(response.night()).isFalse();
        assertThat(response.solarElevationDeg()).isGreaterThan(60.0);
        assertThat(response.pm25()).isEqualTo(80.0);
        // 최근접 측정소 PM10/PM2.5 비율(40/20=2.0)로 추정: 80 * 2.0 = 160
        assertThat(response.pm10()).isEqualTo(160.0);
        assertThat(response.grade()).isEqualTo("매우나쁨");
        // 가시거리: 3.912 / (0.0134 + 0.0039*80) = 12.0km
        assertThat(response.visibilityKm()).isEqualTo(12.0);
        // 기상청 풍속을 AI 입력으로 전달
        verify(aiClient).predict(eq("test_model"), any(), eq(28.0), eq(60.0), eq(2.5),
                any(), any(), any());
    }

    @Test
    void 기상_조회_실패_시_풍속_0으로_추론한다() {
        when(kmaWeatherService.current(anyDouble(), anyDouble()))
                .thenThrow(new IllegalStateException("기상청 장애"));
        when(aiClient.predict(anyString(), any(), anyDouble(), anyDouble(), anyDouble(),
                any(), any(), any()))
                .thenReturn(new AiServiceClient.PredictData(30.0, "보통", "test_model"));

        CctvEstimateResponse response = service(DAY)
                .estimate(1L, "test_model", image, 28.0, 60.0);

        assertThat(response.pm25()).isEqualTo(30.0);
        verify(aiClient).predict(eq("test_model"), any(), eq(28.0), eq(60.0), eq(0.0),
                any(), any(), any());
    }

    @Test
    void 야간에는_이미지_추론_대신_최근접_실측으로_대체한다() {
        CctvEstimateResponse response = service(NIGHT)
                .estimate(1L, "test_model", image, 24.0, 70.0);

        assertThat(response.mode()).isEqualTo("STATION_FALLBACK");
        assertThat(response.night()).isTrue();
        assertThat(response.solarElevationDeg()).isLessThan(0.0);
        assertThat(response.pm25()).isEqualTo(20.0);
        assertThat(response.pm10()).isEqualTo(40.0);
        assertThat(response.grade()).isEqualTo("보통");
        assertThat(response.stationName()).isEqualTo("주안");
        verify(aiClient, never()).predict(anyString(), any(), anyDouble(), anyDouble(),
                anyDouble(), any(), any(), any());
    }

    @Test
    void 야간_대체가_불가능하면_명시적_오류를_반환한다() {
        when(airKoreaService.current(anyString())).thenReturn(current());

        assertThatThrownBy(() -> service(NIGHT).estimate(1L, "test_model", image, 24.0, 70.0))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("야간");
    }

    @Test
    void 가시거리는_고농도에서_짧아지고_저농도에서_상한으로_클램프된다() {
        assertThat(CctvEstimateService.visibilityKm(0.0)).isEqualTo(20.0);
        assertThat(CctvEstimateService.visibilityKm(100.0)).isEqualTo(9.7);
        assertThat(CctvEstimateService.visibilityKm(500.0)).isEqualTo(2.0);
    }

    private static CurrentAirQualityResponse current(StationAirQuality... stations) {
        return new CurrentAirQualityResponse("인천", "AirKorea", false, false,
                Instant.parse("2026-07-18T02:00:00Z"), null, List.of(stations));
    }

    private static StationAirQuality station(String name, double lat, double lon,
                                             Double pm25, Double pm10) {
        return new StationAirQuality(name, "인천", lat, lon, true,
                Instant.parse("2026-07-18T02:00:00Z"),
                pollutant(pm10), pollutant(pm25), null, null, null, null, null);
    }

    private static PollutantValue pollutant(Double value) {
        return value == null
                ? new PollutantValue(null, "㎍/㎥", null, false, "NO_DATA")
                : new PollutantValue(value, "㎍/㎥", "좋음", true, "OK");
    }

    private static WeatherNowResponse weatherNow(Double windSpeed) {
        return new WeatherNowResponse(37.46, 126.665, 55, 124,
                Instant.parse("2026-07-18T02:40:00Z"), "KMA", false, false,
                28.0, 60.0, null, null, windSpeed, 270.0, "서풍", 90.0);
    }
}
