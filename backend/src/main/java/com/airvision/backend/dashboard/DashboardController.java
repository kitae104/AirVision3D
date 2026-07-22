package com.airvision.backend.dashboard;

import com.airvision.backend.common.ApiResponse;
import com.airvision.backend.site.Districts;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Dashboard", description = "대시보드 요약 API")
@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @Operation(summary = "대시보드 요약 (최신 평균 PM2.5, 등급, 관측소 수, 최근 예측·보간 건수, 구 필터)")
    @GetMapping("/summary")
    public ApiResponse<Map<String, Object>> summary(
            @RequestParam(required = false) String district) {
        return ApiResponse.ok(dashboardService.summary(Districts.validate(district)));
    }

    @Operation(summary = "시간별 평균 PM2.5 (최근 N시간, 구 필터)")
    @GetMapping("/hourly")
    public ApiResponse<List<Map<String, Object>>> hourly(
            @RequestParam(defaultValue = "24") int hours,
            @RequestParam(required = false) String district) {
        return ApiResponse.ok(dashboardService.hourlyAverage(
                Math.min(Math.max(hours, 1), 168), Districts.validate(district)));
    }
}
