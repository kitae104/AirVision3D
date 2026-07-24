package com.airvision.backend.publicdata.wind;

import com.airvision.backend.common.ApiResponse;
import com.airvision.backend.publicdata.wind.dto.DistrictForecastResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 인천 핵심 3구 확산 예측 요약 API.
 * 기존 GET /api/air-quality/forecast(대기질 예보통보)와 구분되는 별도 경로를 사용한다.
 */
@Tag(name = "Wind", description = "인천권 바람장과 PM2.5 이동 예측 API")
@RestController
@RequestMapping("/api/air-quality/district-forecast")
public class DistrictForecastController {

    private final DistrictForecastService districtForecastService;

    public DistrictForecastController(DistrictForecastService districtForecastService) {
        this.districtForecastService = districtForecastService;
    }

    @Operation(summary = "미추홀·남동·연수 구별 현재 추정치 + 바람 벡터 + 시간별 이동 예측 (1~6시간)")
    @GetMapping
    public ApiResponse<DistrictForecastResponse> forecast(
            @RequestParam(defaultValue = "6") int hours) {
        return ApiResponse.ok(districtForecastService.forecast(hours));
    }
}
