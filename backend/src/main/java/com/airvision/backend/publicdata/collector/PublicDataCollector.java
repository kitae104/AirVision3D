package com.airvision.backend.publicdata.collector;

import com.airvision.backend.publicdata.airkorea.AirKoreaService;
import com.airvision.backend.publicdata.airkorea.dto.PollutantValue;
import com.airvision.backend.publicdata.airkorea.dto.StationAirQuality;
import com.airvision.backend.publicdata.collector.dto.CollectionResult;
import com.airvision.backend.publicdata.comparison.ComparisonService;
import com.airvision.backend.publicdata.comparison.dto.ComparisonRow;
import com.airvision.backend.publicdata.history.ComparisonHistoryRepository;
import com.airvision.backend.publicdata.history.PublicAirMeasurementRepository;
import com.airvision.backend.publicdata.history.PublicWeatherObservationRepository;
import com.airvision.backend.publicdata.kma.KmaWeatherService;
import com.airvision.backend.publicdata.kma.dto.WeatherNowResponse;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 공공 데이터를 매시간 수집해 DB에 누적한다.
 * 각 단위는 개별 try/catch로 격리되며(한 건 실패가 전체를 막지 않음),
 * 리포지토리 upsert가 ON CONFLICT로 멱등이므로 재수집·중복이 안전하다.
 * collectOnce()에 @Transactional을 붙이지 않아 각 upsert가 개별 트랜잭션으로 커밋된다.
 */
@Component
public class PublicDataCollector {

    private static final Logger log = LoggerFactory.getLogger(PublicDataCollector.class);

    private final AirKoreaService airKoreaService;
    private final KmaWeatherService weatherService;
    private final ComparisonService comparisonService;
    private final PublicAirMeasurementRepository measurementRepo;
    private final PublicWeatherObservationRepository weatherRepo;
    private final ComparisonHistoryRepository comparisonRepo;
    private final CollectionProperties props;
    private final Clock clock;

    PublicDataCollector(AirKoreaService airKoreaService, KmaWeatherService weatherService,
                               ComparisonService comparisonService,
                               PublicAirMeasurementRepository measurementRepo,
                               PublicWeatherObservationRepository weatherRepo,
                               ComparisonHistoryRepository comparisonRepo,
                               CollectionProperties props, Clock clock) {
        this.airKoreaService = airKoreaService;
        this.weatherService = weatherService;
        this.comparisonService = comparisonService;
        this.measurementRepo = measurementRepo;
        this.weatherRepo = weatherRepo;
        this.comparisonRepo = comparisonRepo;
        this.props = props;
        this.clock = clock;
    }

    @org.springframework.beans.factory.annotation.Autowired
    public PublicDataCollector(AirKoreaService airKoreaService, KmaWeatherService weatherService,
                               ComparisonService comparisonService,
                               PublicAirMeasurementRepository measurementRepo,
                               PublicWeatherObservationRepository weatherRepo,
                               ComparisonHistoryRepository comparisonRepo,
                               CollectionProperties props) {
        this(airKoreaService, weatherService, comparisonService, measurementRepo, weatherRepo,
                comparisonRepo, props, Clock.systemUTC());
    }

    @Scheduled(cron = "${airvision.public-data.collection.cron:0 10 * * * *}")
    public void collectHourly() {
        if (!props.enabled()) {
            return;
        }
        collectOnce();
    }

    @Scheduled(cron = "${airvision.public-data.collection.cleanup-cron:0 30 3 * * *}")
    public void cleanup() {
        if (!props.enabled()) {
            return;
        }
        Instant cutoff = clock.instant().minus(Duration.ofDays(props.retentionDays()));
        measurementRepo.deleteByMeasuredAtBefore(cutoff);
        weatherRepo.deleteByBaseTimeBefore(cutoff);
        log.info("공공 데이터 정리: {} 이전 삭제", cutoff);
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onStartup() {
        if (props.enabled() && props.collectOnStartup()) {
            try {
                collectOnce();
            } catch (RuntimeException e) {
                log.warn("기동 수집 실패: {}", e.getMessage());
            }
        }
    }

    public CollectionResult collectOnce() {
        Instant now = clock.instant();
        boolean mock = airKoreaService.isMock();
        int measurements = 0;
        int weather = 0;
        int comparisons = 0;

        for (String sido : props.sidos()) {
            try {
                for (StationAirQuality s : airKoreaService.current(sido).stations()) {
                    if (s.measuredAt() == null) {
                        continue;
                    }
                    measurementRepo.upsert(s.stationName(), s.sidoName(),
                            s.latitude(), s.longitude(), s.measuredAt(),
                            val(s.pm10()), val(s.pm25()), val(s.o3()), val(s.no2()),
                            val(s.co()), val(s.so2()), val(s.khai()),
                            grade(s.pm10()), grade(s.pm25()), mock, now);
                    measurements++;
                }
            } catch (RuntimeException e) {
                log.warn("측정 수집 실패 ({}): {}", sido, e.getMessage());
            }
        }

        for (CollectionProperties.WeatherPoint p : props.weatherPoints()) {
            try {
                WeatherNowResponse w = weatherService.current(p.latitude(), p.longitude());
                if (w.baseTime() != null) {
                    weatherRepo.upsert(p.sido(), w.gridX(), w.gridY(),
                            w.latitude(), w.longitude(), w.baseTime(),
                            w.temperature(), w.humidity(), w.windSpeed(),
                            w.windDirectionDegree(), w.precipitationType(), w.mock(), now);
                    weather++;
                }
            } catch (RuntimeException e) {
                log.warn("기상 수집 실패 ({}): {}", p.sido(), e.getMessage());
            }
        }

        try {
            for (ComparisonRow row : comparisonService.latest().rows()) {
                if (!row.matched()) {
                    continue;
                }
                comparisonRepo.insertSnapshot(row.siteId(), row.siteName(), row.predictedAt(),
                        row.predictedPm25(), row.stationName(), row.measuredAt(),
                        row.measuredPm25(), row.distanceKm(), row.timeDiffMinutes(),
                        row.absoluteError(), row.errorRatePercent(), now);
                comparisons++;
            }
        } catch (RuntimeException e) {
            log.warn("비교 스냅샷 실패: {}", e.getMessage());
        }

        log.info("공공 데이터 수집: 측정 {}, 기상 {}, 비교 {} (mock={})",
                measurements, weather, comparisons, mock);
        return new CollectionResult(measurements, weather, comparisons, mock, now);
    }

    /** 유효한 측정값만 숫자로, 그 외(결측·장애)는 null. */
    private static Double val(PollutantValue v) {
        return v != null && v.valid() ? v.value() : null;
    }

    private static String grade(PollutantValue v) {
        return v == null ? null : v.grade();
    }
}
