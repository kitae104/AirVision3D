package com.airvision.backend.prediction;

import com.airvision.backend.common.ApiResponse;
import com.airvision.backend.common.PageResponse;
import com.airvision.backend.prediction.dto.PredictionResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@Tag(name = "Predictions", description = "AI 예측 실행·조회 API")
@RestController
@Validated
@RequestMapping("/api/predictions")
public class PredictionController {

    private final PredictionService predictionService;
    private final CctvEstimateService cctvEstimateService;

    public PredictionController(PredictionService predictionService,
                                CctvEstimateService cctvEstimateService) {
        this.predictionService = predictionService;
        this.cctvEstimateService = cctvEstimateService;
    }

    @Operation(summary = "AI 예측 실행",
            description = "이미지와 환경값으로 AI 서비스를 호출해 PM2.5를 예측하고 저장한다")
    @PostMapping(value = "/run", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<PredictionResponse> run(
            @RequestParam Long siteId,
            @RequestParam(defaultValue = "resnet18_multimodal_v1") String modelName,
            @RequestPart MultipartFile image,
            @RequestParam double temperature,
            @RequestParam @DecimalMin("0") @DecimalMax("100") double humidity,
            @RequestParam @DecimalMin("0") double windSpeed) {
        if (image.isEmpty()) {
            throw new IllegalArgumentException("이미지 파일이 비어 있습니다");
        }
        return ApiResponse.ok(predictionService.run(
                siteId, modelName, image, temperature, humidity, windSpeed));
    }

    @Operation(summary = "CCTV 이미지 기반 미세먼지·가시거리 추정",
            description = "주간엔 AI 이미지 추론, 야간(태양고도<0도)엔 최근접 실측으로 대체. "
                    + "결과는 저장하지 않는 즉시 추정이다")
    @PostMapping(value = "/cctv", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<com.airvision.backend.prediction.dto.CctvEstimateResponse> cctv(
            @RequestParam Long siteId,
            @RequestParam(defaultValue = "resnet18_multimodal_v1") String modelName,
            @RequestPart MultipartFile image,
            @RequestParam double temperature,
            @RequestParam @DecimalMin("0") @DecimalMax("100") double humidity) {
        if (image.isEmpty()) {
            throw new IllegalArgumentException("이미지 파일이 비어 있습니다");
        }
        return ApiResponse.ok(cctvEstimateService.estimate(
                siteId, modelName, image, temperature, humidity));
    }

    @Operation(summary = "예측 결과 목록 조회 (최신순, 관측소·구 필터)")
    @GetMapping
    public ApiResponse<PageResponse<PredictionResponse>> list(
            @RequestParam(required = false) Long siteId,
            @RequestParam(required = false) String district,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.ok(predictionService.findRecent(
                siteId, com.airvision.backend.site.Districts.validate(district),
                page, Math.min(size, 200)));
    }

    @Operation(summary = "모델 성능지표 조회 (AI 서비스 프록시)")
    @GetMapping("/models/{modelName}/metrics")
    public ApiResponse<Map<String, Object>> modelMetrics(@PathVariable String modelName) {
        return ApiResponse.ok(predictionService.modelMetrics(modelName));
    }
}
