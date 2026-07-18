package com.airvision.backend.publicdata.comparison;

import com.airvision.backend.common.ApiResponse;
import com.airvision.backend.publicdata.comparison.dto.ComparisonResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** AI 추정 vs AirKorea 실측 비교 API. */
@Tag(name = "Public Air Quality", description = "공공 대기질 (AirKorea) 연동 API")
@RestController
@RequestMapping("/api/air-quality/comparison")
public class ComparisonController {

    private final ComparisonService comparisonService;

    public ComparisonController(ComparisonService comparisonService) {
        this.comparisonService = comparisonService;
    }

    @Operation(summary = "지점별 최신 AI 예측과 공공 실측 비교")
    @GetMapping("/latest")
    public ApiResponse<ComparisonResponse> latest() {
        return ApiResponse.ok(comparisonService.latest());
    }

    @Operation(summary = "특정 지점의 최신 AI 예측 비교")
    @GetMapping("/sites/{siteId}")
    public ApiResponse<ComparisonResponse> bySite(@PathVariable Long siteId) {
        return ApiResponse.ok(comparisonService.bySite(siteId));
    }
}
