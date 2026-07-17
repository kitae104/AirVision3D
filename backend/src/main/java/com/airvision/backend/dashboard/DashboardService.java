package com.airvision.backend.dashboard;

import com.airvision.backend.interpolation.InterpolationResultRepository;
import com.airvision.backend.observation.ObservationRepository;
import com.airvision.backend.prediction.PredictionRepository;
import com.airvision.backend.site.ObservationSiteRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class DashboardService {

    private final ObservationSiteRepository siteRepository;
    private final ObservationRepository observationRepository;
    private final PredictionRepository predictionRepository;
    private final InterpolationResultRepository interpolationRepository;
    private final GradeProperties gradeProperties;

    public DashboardService(ObservationSiteRepository siteRepository,
                            ObservationRepository observationRepository,
                            PredictionRepository predictionRepository,
                            InterpolationResultRepository interpolationRepository,
                            GradeProperties gradeProperties) {
        this.siteRepository = siteRepository;
        this.observationRepository = observationRepository;
        this.predictionRepository = predictionRepository;
        this.interpolationRepository = interpolationRepository;
        this.gradeProperties = gradeProperties;
    }

    public Map<String, Object> summary() {
        Instant now = Instant.now();
        Instant dayAgo = now.minus(Duration.ofHours(24));

        // 관측소별 최신 PM2.5의 평균
        var latest = observationRepository.findLatestPm25PerSite(now);
        Double avgPm25 = latest.isEmpty() ? null : latest.stream()
                .mapToDouble(ObservationRepository.SitePm25::getPm25).average().orElse(0);

        Map<String, Object> result = new HashMap<>();
        result.put("latestAvgPm25", avgPm25 == null ? null : Math.round(avgPm25 * 10) / 10.0);
        result.put("grade", avgPm25 == null ? null : gradeProperties.gradeOf(avgPm25));
        result.put("siteCount", siteRepository.count());
        result.put("recentPredictionCount", predictionRepository.countByPredictedAtAfter(dayAgo));
        result.put("recentInterpolationCount", interpolationRepository.countByCreatedAtAfter(dayAgo));
        return result;
    }

    public List<Map<String, Object>> hourlyAverage(int hours) {
        Instant from = Instant.now().minus(Duration.ofHours(hours));
        return observationRepository.findHourlyAveragePm25(from).stream()
                .map(row -> Map.<String, Object>of(
                        "time", row.getHour(),
                        "avgPm25", row.getAvgPm25() == null ? 0
                                : Math.round(row.getAvgPm25() * 10) / 10.0))
                .toList();
    }
}
