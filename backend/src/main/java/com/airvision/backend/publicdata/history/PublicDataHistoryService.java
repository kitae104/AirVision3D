package com.airvision.backend.publicdata.history;

import com.airvision.backend.publicdata.history.dto.ComparisonHistoryPoint;
import com.airvision.backend.publicdata.history.dto.MeasurementHourlyPoint;
import com.airvision.backend.publicdata.history.dto.MeasurementSeriesPoint;
import com.airvision.backend.publicdata.history.dto.PublicStationSeries;
import com.airvision.backend.publicdata.history.dto.WeatherSeriesPoint;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 누적된 공공 데이터 시계열 조회. */
@Service
@Transactional(readOnly = true)
public class PublicDataHistoryService {

    private static final Duration DEFAULT_WINDOW = Duration.ofHours(48);
    private static final Duration MAX_WINDOW = Duration.ofDays(31);

    private final PublicAirMeasurementRepository measurementRepo;
    private final PublicWeatherObservationRepository weatherRepo;
    private final ComparisonHistoryRepository comparisonRepo;
    private final Clock clock;

    // Spring에는 Clock 빈이 없으므로 @Autowired 생성자는 Clock 없이 위임한다
    // (기존 AirKoreaService/KmaWeatherService와 동일 패턴). Clock 생성자는 테스트용.
    @org.springframework.beans.factory.annotation.Autowired
    public PublicDataHistoryService(PublicAirMeasurementRepository measurementRepo,
                                    PublicWeatherObservationRepository weatherRepo,
                                    ComparisonHistoryRepository comparisonRepo) {
        this(measurementRepo, weatherRepo, comparisonRepo, Clock.systemUTC());
    }

    PublicDataHistoryService(PublicAirMeasurementRepository measurementRepo,
                             PublicWeatherObservationRepository weatherRepo,
                             ComparisonHistoryRepository comparisonRepo, Clock clock) {
        this.measurementRepo = measurementRepo;
        this.weatherRepo = weatherRepo;
        this.comparisonRepo = comparisonRepo;
        this.clock = clock;
    }

    public List<MeasurementHourlyPoint> hourly(String sido, Instant from, Instant to) {
        Instant[] range = range(from, to);
        return measurementRepo.findHourlyAvg(blankToNull(sido), range[0], range[1]).stream()
                .map(h -> new MeasurementHourlyPoint(h.getHour(), h.getAvgPm10(),
                        h.getAvgPm25(), h.getCnt() == null ? 0 : h.getCnt()))
                .toList();
    }

    public List<MeasurementSeriesPoint> stationSeries(String stationName, Instant from, Instant to) {
        Instant[] range = range(from, to);
        return measurementRepo.findByStationNameAndMeasuredAtBetweenOrderByMeasuredAt(
                        stationName, range[0], range[1]).stream()
                .map(MeasurementSeriesPoint::from)
                .toList();
    }

    /**
     * 시도 내 측정소별 누적 PM2.5 시계열 (지도 시계열 재생용). 좌표·pm25가 있는 측정만 담고,
     * 측정소 대표 좌표는 해당 측정소의 마지막(최신) 좌표를 사용한다.
     */
    public List<PublicStationSeries> regionSeries(String sido, Instant from, Instant to) {
        if (sido == null || sido.isBlank()) {
            throw new IllegalArgumentException("sido는 필수입니다");
        }
        Instant[] range = range(from, to);
        // (측정소명, 시각) 정렬로 조회되므로 순차 그룹핑 가능
        Map<String, List<PublicStationSeries.Sample>> samplesByStation = new LinkedHashMap<>();
        Map<String, double[]> coordByStation = new LinkedHashMap<>();
        for (PublicAirMeasurement m : measurementRepo.findRegionSeries(sido.trim(), range[0], range[1])) {
            String name = m.getStationName();
            samplesByStation.computeIfAbsent(name, k -> new ArrayList<>())
                    .add(new PublicStationSeries.Sample(
                            m.getMeasuredAt(), m.getPm25(), m.getPm25Grade()));
            // 마지막(최신) 좌표로 갱신 — 시각 오름차순이므로 순차 갱신이면 최신값이 남는다
            coordByStation.put(name, new double[]{m.getLatitude(), m.getLongitude()});
        }
        List<PublicStationSeries> result = new ArrayList<>(samplesByStation.size());
        for (Map.Entry<String, List<PublicStationSeries.Sample>> e : samplesByStation.entrySet()) {
            double[] coord = coordByStation.get(e.getKey());
            result.add(new PublicStationSeries(e.getKey(), coord[0], coord[1], e.getValue()));
        }
        return result;
    }

    public List<WeatherSeriesPoint> weatherSeries(String sido, Instant from, Instant to) {
        Instant[] range = range(from, to);
        return weatherRepo.findBySidoAndBaseTimeBetweenOrderByBaseTime(sido, range[0], range[1])
                .stream()
                .map(WeatherSeriesPoint::from)
                .toList();
    }

    public List<ComparisonHistoryPoint> comparisonHistory(Instant from, Instant to) {
        Instant[] range = range(from, to);
        return comparisonRepo.findByComputedAtBetweenOrderByComputedAt(range[0], range[1]).stream()
                .map(ComparisonHistoryPoint::from)
                .toList();
    }

    public long accumulatedCount() {
        return measurementRepo.count();
    }

    public Instant earliestCollectedAt() {
        return measurementRepo.findFirstByOrderByCollectedAtAsc()
                .map(PublicAirMeasurement::getCollectedAt)
                .orElse(null);
    }

    /** null 기본(최근 48h) + 검증. */
    private Instant[] range(Instant from, Instant to) {
        Instant end = to != null ? to : clock.instant();
        Instant start = from != null ? from : end.minus(DEFAULT_WINDOW);
        if (!start.isBefore(end)) {
            throw new IllegalArgumentException("from은 to보다 앞서야 합니다");
        }
        if (Duration.between(start, end).compareTo(MAX_WINDOW) > 0) {
            throw new IllegalArgumentException("조회 기간은 최대 31일입니다");
        }
        return new Instant[]{start, end};
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
