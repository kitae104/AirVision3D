package com.airvision.backend.publicdata.collector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.airvision.backend.publicdata.airkorea.AirKoreaService;
import com.airvision.backend.publicdata.airkorea.dto.CurrentAirQualityResponse;
import com.airvision.backend.publicdata.airkorea.dto.PollutantValue;
import com.airvision.backend.publicdata.airkorea.dto.StationAirQuality;
import com.airvision.backend.publicdata.collector.dto.CollectionResult;
import com.airvision.backend.publicdata.comparison.ComparisonService;
import com.airvision.backend.publicdata.comparison.dto.ComparisonResponse;
import com.airvision.backend.publicdata.comparison.dto.ComparisonRow;
import com.airvision.backend.publicdata.history.ComparisonHistoryRepository;
import com.airvision.backend.publicdata.history.PublicAirMeasurementRepository;
import com.airvision.backend.publicdata.history.PublicWeatherObservationRepository;
import com.airvision.backend.publicdata.kma.KmaWeatherService;
import com.airvision.backend.publicdata.kma.dto.WeatherNowResponse;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class PublicDataCollectorTest {

    private static final Instant NOW = Instant.parse("2026-07-18T05:10:00Z");

    private AirKoreaService airKoreaService;
    private KmaWeatherService weatherService;
    private ComparisonService comparisonService;
    private PublicAirMeasurementRepository measurementRepo;
    private PublicWeatherObservationRepository weatherRepo;
    private ComparisonHistoryRepository comparisonRepo;
    private PublicDataCollector collector;

    private static PollutantValue pv(Double value, String grade, boolean valid) {
        return new PollutantValue(value, "µg/m³", grade, valid,
                valid ? "NORMAL" : "NO_DATA");
    }

    private static StationAirQuality station(String name, Instant measuredAt, Double pm25) {
        PollutantValue v = pv(pm25, "보통", pm25 != null);
        return new StationAirQuality(name, "인천", 37.4, 126.7, true, measuredAt,
                pv(40.0, "보통", true), v, v, v, v, v, v);
    }

    private static CollectionProperties props(boolean enabled) {
        return new CollectionProperties(enabled, "0 10 * * * *", "0 30 3 * * *", 180, false,
                List.of("서울", "인천"),
                List.of(new CollectionProperties.WeatherPoint("인천", 37.4563, 126.7052)));
    }

    private static WeatherNowResponse weather() {
        return new WeatherNowResponse(37.4563, 126.7052, 55, 124,
                Instant.parse("2026-07-18T05:00:00Z"), "KMA", true, false,
                27.0, 60.0, 0.0, "없음", 2.4, 315.0, "북서풍", 135.0);
    }

    private void bootstrap(boolean enabled) {
        collector = new PublicDataCollector(airKoreaService, weatherService, comparisonService,
                measurementRepo, weatherRepo, comparisonRepo, props(enabled),
                Clock.fixed(NOW, ZoneId.of("UTC")));
    }

    @BeforeEach
    void setUp() {
        airKoreaService = mock(AirKoreaService.class);
        weatherService = mock(KmaWeatherService.class);
        comparisonService = mock(ComparisonService.class);
        measurementRepo = mock(PublicAirMeasurementRepository.class);
        weatherRepo = mock(PublicWeatherObservationRepository.class);
        comparisonRepo = mock(ComparisonHistoryRepository.class);
        when(airKoreaService.isMock()).thenReturn(true);
        when(weatherService.current(anyDouble(), anyDouble())).thenReturn(weather());
        when(comparisonService.latest()).thenReturn(
                new ComparisonResponse(5, 60, "인천", true, List.of()));
    }

    @Test
    void 시도별_측정소를_수집하고_measuredAt이_null이면_건너뛴다() {
        bootstrap(true);
        when(airKoreaService.current("서울")).thenReturn(new CurrentAirQualityResponse(
                "서울", "AIRKOREA", true, false, NOW, null,
                List.of(station("서울역", Instant.parse("2026-07-18T05:00:00Z"), 20.0),
                        station("빈측정소", null, 30.0))));  // measuredAt null → 건너뜀
        when(airKoreaService.current("인천")).thenReturn(new CurrentAirQualityResponse(
                "인천", "AIRKOREA", true, false, NOW, null,
                List.of(station("송도", Instant.parse("2026-07-18T05:00:00Z"), 12.0))));

        CollectionResult result = collector.collectOnce();

        assertThat(result.measurementsUpserted()).isEqualTo(2);  // 서울역 + 송도 (빈측정소 제외)
        assertThat(result.weatherUpserted()).isEqualTo(1);
        assertThat(result.mock()).isTrue();
        verify(measurementRepo, times(2)).upsert(any(), any(), any(), any(), any(),
                any(), any(), any(), any(), any(), any(), any(), any(), any(),
                anyBoolean(), any());
    }

    @Test
    void 한_시도_수집이_실패해도_다른_시도는_계속한다() {
        bootstrap(true);
        when(airKoreaService.current("서울")).thenThrow(new RuntimeException("API 오류"));
        when(airKoreaService.current("인천")).thenReturn(new CurrentAirQualityResponse(
                "인천", "AIRKOREA", true, false, NOW, null,
                List.of(station("송도", Instant.parse("2026-07-18T05:00:00Z"), 12.0))));

        CollectionResult result = collector.collectOnce();

        assertThat(result.measurementsUpserted()).isEqualTo(1);  // 인천만 성공
        assertThat(result.weatherUpserted()).isEqualTo(1);       // 기상은 영향 없음
    }

    @Test
    void 매칭된_비교_행만_스냅샷으로_저장한다() {
        bootstrap(true);
        when(airKoreaService.current(any())).thenReturn(new CurrentAirQualityResponse(
                "인천", "AIRKOREA", true, false, NOW, null, List.of()));
        ComparisonRow matched = new ComparisonRow(1L, "인천송도",
                Instant.parse("2026-07-18T05:00:00Z"), 30.0, "송도",
                Instant.parse("2026-07-18T05:00:00Z"), 25.0, 1.2, 0L, 5.0, 20.0, true, null);
        ComparisonRow unmatched = new ComparisonRow(2L, "먼지점",
                Instant.parse("2026-07-18T05:00:00Z"), 40.0, null, null, null, null, null,
                null, null, false, "허용 거리 초과");
        when(comparisonService.latest()).thenReturn(
                new ComparisonResponse(5, 60, "인천", true, List.of(matched, unmatched)));

        CollectionResult result = collector.collectOnce();

        assertThat(result.comparisonSnapshots()).isEqualTo(1);
        verify(comparisonRepo, times(1)).insertSnapshot(eq(1L), any(), any(), eq(30.0),
                any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void enabled가_false면_아무것도_하지_않는다() {
        bootstrap(false);

        collector.collectHourly();

        verifyNoInteractions(airKoreaService, weatherService, comparisonService,
                measurementRepo, weatherRepo, comparisonRepo);
    }

    @Test
    void 실측_유효하지_않으면_null로_저장한다() {
        bootstrap(true);
        when(airKoreaService.current("서울")).thenReturn(new CurrentAirQualityResponse(
                "서울", "AIRKOREA", true, false, NOW, null,
                List.of(station("점검소", Instant.parse("2026-07-18T05:00:00Z"), null))));
        when(airKoreaService.current("인천")).thenReturn(new CurrentAirQualityResponse(
                "인천", "AIRKOREA", true, false, NOW, null, List.of()));

        collector.collectOnce();

        // pm25 파라미터(7번째)가 null로 전달됨
        verify(measurementRepo).upsert(eq("점검소"), any(), any(), any(), any(),
                any(), org.mockito.ArgumentMatchers.isNull(), any(), any(), any(), any(),
                any(), any(), any(), anyBoolean(), any());
    }
}
