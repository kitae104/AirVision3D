package com.airvision.backend.publicdata.comparison;

import com.airvision.backend.common.GeoUtils;
import com.airvision.backend.publicdata.PublicDataProperties;
import com.airvision.backend.publicdata.airkorea.AirKoreaService;
import com.airvision.backend.publicdata.airkorea.dto.CurrentAirQualityResponse;
import com.airvision.backend.publicdata.airkorea.dto.StationAirQuality;
import com.airvision.backend.publicdata.comparison.dto.ComparisonResponse;
import com.airvision.backend.publicdata.comparison.dto.ComparisonRow;
import com.airvision.backend.prediction.PredictionRepository;
import com.airvision.backend.prediction.PredictionRepository.LatestPrediction;
import java.time.Duration;
import java.util.List;
import java.util.Objects;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * AI 예측(자체 모델) ↔ AirKorea 공공 실측 비교.
 * 예측 지점에서 가장 가까운 유효 측정소를 찾아 거리·시간 허용범위 안에서만 비교한다.
 * 매칭이 불가능하면 억지로 비교값을 만들지 않고 사유를 표시한다.
 */
@Service
@Transactional(readOnly = true)
public class ComparisonService {

    private final PredictionRepository predictionRepository;
    private final AirKoreaService airKoreaService;
    private final PublicDataProperties.Comparison policy;

    public ComparisonService(PredictionRepository predictionRepository,
                             AirKoreaService airKoreaService,
                             PublicDataProperties publicDataProps) {
        this.predictionRepository = predictionRepository;
        this.airKoreaService = airKoreaService;
        this.policy = publicDataProps.comparison();
    }

    /** 지점별 최신 AI 예측과 공공 실측 비교. */
    public ComparisonResponse latest() {
        List<LatestPrediction> predictions = predictionRepository.findLatestPerSite();
        CurrentAirQualityResponse current = airKoreaService.current(null);
        List<ComparisonRow> rows = predictions.stream()
                .map(p -> match(p, current.stations()))
                .toList();
        return new ComparisonResponse(policy.maxDistanceKm(), policy.maxMinutes(),
                current.sido(), current.mock(), rows);
    }

    /** 특정 지점의 최신 AI 예측 비교. */
    public ComparisonResponse bySite(Long siteId) {
        CurrentAirQualityResponse current = airKoreaService.current(null);
        List<ComparisonRow> rows = predictionRepository.findLatestPerSite().stream()
                .filter(p -> Objects.equals(p.getSiteId(), siteId))
                .map(p -> match(p, current.stations()))
                .toList();
        return new ComparisonResponse(policy.maxDistanceKm(), policy.maxMinutes(),
                current.sido(), current.mock(), rows);
    }

    private ComparisonRow match(LatestPrediction prediction, List<StationAirQuality> stations) {
        // 좌표와 유효한 PM2.5 실측값이 있는 측정소 중 최근접 선택
        StationAirQuality nearest = null;
        double nearestKm = Double.MAX_VALUE;
        for (StationAirQuality station : stations) {
            if (!station.locationAvailable() || station.pm25() == null
                    || !station.pm25().valid() || station.pm25().value() == null) {
                continue;
            }
            double km = GeoUtils.haversineKm(prediction.getLatitude(), prediction.getLongitude(),
                    station.latitude(), station.longitude());
            if (km < nearestKm) {
                nearestKm = km;
                nearest = station;
            }
        }

        if (nearest == null) {
            return ComparisonRow.unmatched(prediction, "유효한 실측값이 있는 측정소가 없습니다");
        }
        if (nearestKm > policy.maxDistanceKm()) {
            return ComparisonRow.unmatched(prediction,
                    "가장 가까운 측정소(%s)가 허용 거리 %.0fkm를 벗어남 (%.1fkm)"
                            .formatted(nearest.stationName(), policy.maxDistanceKm(), nearestKm));
        }
        if (nearest.measuredAt() == null || prediction.getPredictedAt() == null) {
            return ComparisonRow.unmatched(prediction, "측정시각 또는 예측시각 정보가 없습니다");
        }
        long diffMinutes = Math.abs(
                Duration.between(prediction.getPredictedAt(), nearest.measuredAt()).toMinutes());
        if (diffMinutes > policy.maxMinutes()) {
            return ComparisonRow.unmatched(prediction,
                    "측정시각 차이 %d분이 허용 범위 %d분을 벗어남"
                            .formatted(diffMinutes, policy.maxMinutes()));
        }

        double measured = nearest.pm25().value();
        double absoluteError = Math.abs(prediction.getPm25() - measured);
        // 실측값이 0이거나 유효하지 않으면 오차율 계산 생략
        Double errorRate = measured == 0 ? null
                : Math.round(absoluteError / measured * 1000) / 10.0;
        return new ComparisonRow(prediction.getSiteId(), prediction.getSiteName(),
                prediction.getPredictedAt(), round1(prediction.getPm25()),
                nearest.stationName(), nearest.measuredAt(), measured,
                Math.round(nearestKm * 100) / 100.0, diffMinutes,
                round1(absoluteError), errorRate, true, null);
    }

    private static double round1(double v) {
        return Math.round(v * 10) / 10.0;
    }
}
