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
