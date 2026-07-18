package com.airvision.backend.publicdata.history;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.airvision.backend.publicdata.history.PublicAirMeasurementRepository.HourlyAvg;
import com.airvision.backend.publicdata.history.dto.ComparisonHistoryPoint;
import com.airvision.backend.publicdata.history.dto.MeasurementHourlyPoint;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class PublicDataHistoryServiceTest {

    private static final Instant NOW = Instant.parse("2026-07-18T05:00:00Z");

    private PublicAirMeasurementRepository measurementRepo;
    private PublicWeatherObservationRepository weatherRepo;
    private ComparisonHistoryRepository comparisonRepo;
    private PublicDataHistoryService service;

    private static HourlyAvg hourly(Instant hour, double pm10, double pm25, long cnt) {
        return new HourlyAvg() {
            public Instant getHour() {
                return hour;
            }

            public Double getAvgPm10() {
                return pm10;
            }

            public Double getAvgPm25() {
                return pm25;
            }

            public Long getCnt() {
                return cnt;
            }
        };
    }

    @BeforeEach
    void setUp() {
        measurementRepo = mock(PublicAirMeasurementRepository.class);
        weatherRepo = mock(PublicWeatherObservationRepository.class);
        comparisonRepo = mock(ComparisonHistoryRepository.class);
        service = new PublicDataHistoryService(measurementRepo, weatherRepo, comparisonRepo,
                Clock.fixed(NOW, ZoneId.of("UTC")));
    }

    @Test
    void 시간별_평균_projection을_DTO로_매핑한다() {
        when(measurementRepo.findHourlyAvg(eq("인천"), any(), any())).thenReturn(List.of(
                hourly(Instant.parse("2026-07-18T04:00:00Z"), 40.0, 22.5, 8)));

        List<MeasurementHourlyPoint> points = service.hourly("인천",
                Instant.parse("2026-07-18T00:00:00Z"), NOW);

        assertThat(points).hasSize(1);
        assertThat(points.get(0).avgPm25()).isEqualTo(22.5);
        assertThat(points.get(0).count()).isEqualTo(8);
    }

    @Test
    void 기간_미지정이면_최근_48시간을_기본으로_쓴다() {
        when(measurementRepo.findHourlyAvg(isNull(), any(), any())).thenReturn(List.of());

        service.hourly(null, null, null);

        // from = NOW - 48h, to = NOW 로 리포지토리를 호출한다
        org.mockito.ArgumentCaptor<Instant> fromCap =
                org.mockito.ArgumentCaptor.forClass(Instant.class);
        org.mockito.Mockito.verify(measurementRepo)
                .findHourlyAvg(isNull(), fromCap.capture(), eq(NOW));
        assertThat(fromCap.getValue()).isEqualTo(NOW.minusSeconds(48 * 3600));
    }

    @Test
    void from이_to보다_같거나_크면_예외다() {
        assertThatThrownBy(() -> service.hourly(null, NOW, NOW.minusSeconds(3600)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void 비교_이력_엔티티를_DTO로_매핑한다() {
        ComparisonHistory h = mock(ComparisonHistory.class);
        when(h.getComputedAt()).thenReturn(NOW);
        when(h.getSiteName()).thenReturn("인천송도");
        when(h.getPredictedAt()).thenReturn(NOW.minusSeconds(600));
        when(h.getPredictedPm25()).thenReturn(30.0);
        when(h.getStationName()).thenReturn("송도");
        when(h.getMeasuredPm25()).thenReturn(25.0);
        when(h.getAbsoluteError()).thenReturn(5.0);
        when(h.getErrorRatePercent()).thenReturn(20.0);
        when(comparisonRepo.findByComputedAtBetweenOrderByComputedAt(any(), any()))
                .thenReturn(List.of(h));

        List<ComparisonHistoryPoint> points = service.comparisonHistory(null, null);

        assertThat(points).hasSize(1);
        assertThat(points.get(0).siteName()).isEqualTo("인천송도");
        assertThat(points.get(0).absoluteError()).isEqualTo(5.0);
    }
}
