package com.airvision.backend.publicdata.comparison;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.airvision.backend.publicdata.PublicDataProperties;
import com.airvision.backend.publicdata.airkorea.AirKoreaService;
import com.airvision.backend.publicdata.airkorea.dto.CurrentAirQualityResponse;
import com.airvision.backend.publicdata.airkorea.dto.PollutantValue;
import com.airvision.backend.publicdata.airkorea.dto.StationAirQuality;
import com.airvision.backend.publicdata.comparison.dto.ComparisonResponse;
import com.airvision.backend.publicdata.comparison.dto.ComparisonRow;
import com.airvision.backend.prediction.PredictionRepository;
import com.airvision.backend.prediction.PredictionRepository.LatestPrediction;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ComparisonServiceTest {

    private static final Instant NOW = Instant.parse("2026-07-18T05:00:00Z");

    private PredictionRepository predictionRepository;
    private AirKoreaService airKoreaService;
    private ComparisonService service;

    /** 테스트용 LatestPrediction 구현. */
    private record TestPrediction(Long getSiteId, String getSiteName, Double getLatitude,
                                  Double getLongitude, Double getPm25, String getGrade,
                                  Instant getPredictedAt) implements LatestPrediction {
    }

    private static StationAirQuality station(String name, double lat, double lng,
                                             Double pm25, Instant measuredAt) {
        PollutantValue value = pm25 == null
                ? new PollutantValue(null, "µg/m³", null, false, "NO_DATA")
                : new PollutantValue(pm25, "µg/m³", "보통", true, "NORMAL");
        return new StationAirQuality(name, "인천", lat, lng, true, measuredAt,
                value, value, value, value, value, value, value);
    }

    @BeforeEach
    void setUp() {
        predictionRepository = mock(PredictionRepository.class);
        airKoreaService = mock(AirKoreaService.class);
        PublicDataProperties props = new PublicDataProperties("auto",
                new PublicDataProperties.Cache(1800, 86400, 3600, 1800, 1800),
                new PublicDataProperties.Comparison(5, 60));
        service = new ComparisonService(predictionRepository, airKoreaService, props);
    }

    private void givenStations(StationAirQuality... stations) {
        when(airKoreaService.current(any())).thenReturn(new CurrentAirQualityResponse(
                "인천", "AIRKOREA", true, false, NOW, null, List.of(stations)));
    }

    @Test
    void 허용_범위_안의_최근접_측정소와_비교한다() {
        // 예측 지점(송도 인근)에서 약 1km 거리 측정소
        when(predictionRepository.findLatestPerSite()).thenReturn(List.of(
                new TestPrediction(1L, "인천송도", 37.39, 126.65, 30.0, "보통", NOW)));
        givenStations(
                station("송도", 37.3826, 126.6546, 25.0, NOW.minusSeconds(1800)),
                station("부평", 37.5072, 126.7219, 50.0, NOW));

        ComparisonResponse res = service.latest();

        assertThat(res.rows()).hasSize(1);
        ComparisonRow row = res.rows().get(0);
        assertThat(row.matched()).isTrue();
        assertThat(row.stationName()).isEqualTo("송도");
        assertThat(row.measuredPm25()).isEqualTo(25.0);
        assertThat(row.absoluteError()).isEqualTo(5.0);
        assertThat(row.errorRatePercent()).isEqualTo(20.0);
        assertThat(row.timeDiffMinutes()).isEqualTo(30);
        assertThat(row.distanceKm()).isLessThan(5.0);
    }

    @Test
    void 허용_거리를_벗어나면_매칭하지_않는다() {
        // 서울 시청 인근 예측 vs 인천 측정소 (약 27km)
        when(predictionRepository.findLatestPerSite()).thenReturn(List.of(
                new TestPrediction(1L, "서울시청", 37.5665, 126.9780, 30.0, "보통", NOW)));
        givenStations(station("송도", 37.3826, 126.6546, 25.0, NOW));

        ComparisonRow row = service.latest().rows().get(0);

        assertThat(row.matched()).isFalse();
        assertThat(row.reason()).contains("허용 거리");
        assertThat(row.measuredPm25()).isNull();
        assertThat(row.absoluteError()).isNull();
    }

    @Test
    void 시간_차이가_허용_범위를_벗어나면_매칭하지_않는다() {
        when(predictionRepository.findLatestPerSite()).thenReturn(List.of(
                new TestPrediction(1L, "인천송도", 37.39, 126.65, 30.0, "보통", NOW)));
        givenStations(station("송도", 37.3826, 126.6546, 25.0, NOW.minusSeconds(7200)));

        ComparisonRow row = service.latest().rows().get(0);

        assertThat(row.matched()).isFalse();
        assertThat(row.reason()).contains("측정시각 차이");
    }

    @Test
    void 실측값이_0이면_오차율을_계산하지_않는다() {
        when(predictionRepository.findLatestPerSite()).thenReturn(List.of(
                new TestPrediction(1L, "인천송도", 37.39, 126.65, 3.0, "좋음", NOW)));
        givenStations(station("송도", 37.3826, 126.6546, 0.0, NOW));

        ComparisonRow row = service.latest().rows().get(0);

        assertThat(row.matched()).isTrue();
        assertThat(row.absoluteError()).isEqualTo(3.0);
        assertThat(row.errorRatePercent()).isNull();
    }

    @Test
    void 유효한_실측값이_없으면_사유와_함께_매칭_불가다() {
        when(predictionRepository.findLatestPerSite()).thenReturn(List.of(
                new TestPrediction(1L, "인천송도", 37.39, 126.65, 30.0, "보통", NOW)));
        givenStations(station("송도", 37.3826, 126.6546, null, NOW));

        ComparisonRow row = service.latest().rows().get(0);

        assertThat(row.matched()).isFalse();
        assertThat(row.reason()).contains("유효한 실측값");
    }

    @Test
    void 특정_지점만_필터링해_비교한다() {
        when(predictionRepository.findLatestPerSite()).thenReturn(List.of(
                new TestPrediction(1L, "인천송도", 37.39, 126.65, 30.0, "보통", NOW),
                new TestPrediction(2L, "부평역", 37.507, 126.722, 40.0, "나쁨", NOW)));
        givenStations(station("송도", 37.3826, 126.6546, 25.0, NOW));

        ComparisonResponse res = service.bySite(2L);

        assertThat(res.rows()).hasSize(1);
        assertThat(res.rows().get(0).siteName()).isEqualTo("부평역");
    }
}
