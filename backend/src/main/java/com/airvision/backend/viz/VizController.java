package com.airvision.backend.viz;

import com.airvision.backend.common.ApiResponse;
import com.airvision.backend.dashboard.GradeProperties;
import com.airvision.backend.observation.ObservationRepository;
import com.airvision.backend.prediction.PredictionRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** CesiumJS 3D 지도 시각화용 데이터 API. */
@Tag(name = "Visualization", description = "3D 시각화 데이터 API")
@RestController
@RequestMapping("/api/viz")
public class VizController {

    private final ObservationRepository observationRepository;
    private final PredictionRepository predictionRepository;
    private final GradeProperties gradeProperties;

    public VizController(ObservationRepository observationRepository,
                         PredictionRepository predictionRepository,
                         GradeProperties gradeProperties) {
        this.observationRepository = observationRepository;
        this.predictionRepository = predictionRepository;
        this.gradeProperties = gradeProperties;
    }

    @Operation(summary = "관측소별 최신 관측 PM2.5 (관측 레이어)")
    @GetMapping("/observations/latest")
    public ApiResponse<List<Map<String, Object>>> latestObservations() {
        return ApiResponse.ok(observationRepository.findLatestPm25PerSite(Instant.now()).stream()
                .map(o -> Map.<String, Object>of(
                        "siteId", o.getSiteId(),
                        "siteName", o.getSiteName(),
                        "latitude", o.getLatitude(),
                        "longitude", o.getLongitude(),
                        "pm25", o.getPm25(),
                        "grade", gradeProperties.gradeOf(o.getPm25()),
                        "observedAt", o.getObservedAt()))
                .toList());
    }

    @Operation(summary = "관측 데이터가 존재하는 시간 범위")
    @GetMapping("/observations/time-range")
    public ApiResponse<Map<String, Object>> timeRange() {
        var range = observationRepository.findObservedTimeRange();
        Map<String, Object> result = new java.util.HashMap<>();
        result.put("from", range != null ? range.getMinTime() : null);
        result.put("to", range != null ? range.getMaxTime() : null);
        return ApiResponse.ok(result);
    }

    @Operation(summary = "기간 내 관측소별 PM2.5 시계열 (시계열 시각화용, 최대 7일)")
    @GetMapping("/observations/series")
    public ApiResponse<List<Map<String, Object>>> series(
            @org.springframework.web.bind.annotation.RequestParam
            @org.springframework.format.annotation.DateTimeFormat(
                    iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE_TIME)
            Instant from,
            @org.springframework.web.bind.annotation.RequestParam
            @org.springframework.format.annotation.DateTimeFormat(
                    iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE_TIME)
            Instant to) {
        if (!from.isBefore(to)) {
            throw new IllegalArgumentException("from은 to보다 이전이어야 합니다");
        }
        if (java.time.Duration.between(from, to).toHours() > 168) {
            throw new IllegalArgumentException("조회 기간은 최대 7일(168시간)입니다");
        }

        // 관측소 단위로 그룹핑 (site 순서 유지)
        var grouped = new java.util.LinkedHashMap<Long, Map<String, Object>>();
        for (var row : observationRepository.findSeries(from, to)) {
            var site = grouped.computeIfAbsent(row.getSiteId(), id -> {
                Map<String, Object> m = new java.util.HashMap<>();
                m.put("siteId", row.getSiteId());
                m.put("siteName", row.getSiteName());
                m.put("latitude", row.getLatitude());
                m.put("longitude", row.getLongitude());
                m.put("samples", new java.util.ArrayList<Map<String, Object>>());
                return m;
            });
            @SuppressWarnings("unchecked")
            var samples = (List<Map<String, Object>>) site.get("samples");
            samples.add(Map.of("time", row.getObservedAt(), "pm25", row.getPm25()));
        }
        return ApiResponse.ok(List.copyOf(grouped.values()));
    }

    @Operation(summary = "관측소별 최신 AI 예측 PM2.5 (예측 레이어)")
    @GetMapping("/predictions/latest")
    public ApiResponse<List<Map<String, Object>>> latestPredictions() {
        return ApiResponse.ok(predictionRepository.findLatestPerSite().stream()
                .map(p -> Map.<String, Object>of(
                        "siteId", p.getSiteId(),
                        "siteName", p.getSiteName(),
                        "latitude", p.getLatitude(),
                        "longitude", p.getLongitude(),
                        "pm25", p.getPm25(),
                        "grade", p.getGrade() != null ? p.getGrade()
                                : gradeProperties.gradeOf(p.getPm25()),
                        "predictedAt", p.getPredictedAt()))
                .toList());
    }
}
