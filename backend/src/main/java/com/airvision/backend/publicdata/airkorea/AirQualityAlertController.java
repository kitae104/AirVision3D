package com.airvision.backend.publicdata.airkorea;

import com.airvision.backend.common.ApiResponse;
import com.airvision.backend.publicdata.airkorea.dto.AlertResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** AirKorea 미세먼지 경보 API (출처: 환경부·한국환경공단 AirKorea). */
@Tag(name = "Public Air Quality", description = "공공 대기질 (AirKorea) 연동 API")
@RestController
@RequestMapping("/api/air-quality/alerts")
public class AirQualityAlertController {

    private final AirKoreaService airKoreaService;

    public AirQualityAlertController(AirKoreaService airKoreaService) {
        this.airKoreaService = airKoreaService;
    }

    @Operation(summary = "연도별 경보 발령 현황 (기본: 올해)")
    @GetMapping
    public ApiResponse<List<AlertResponse>> alerts(
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) String region) {
        List<AlertResponse> alerts = airKoreaService.alerts(year).value();
        if (region != null && !region.isBlank()) {
            alerts = alerts.stream()
                    .filter(a -> a.districtName() != null
                            && a.districtName().contains(region.trim()))
                    .toList();
        }
        return ApiResponse.ok(alerts);
    }

    @Operation(summary = "현재 발령 중(미해제) 경보")
    @GetMapping("/active")
    public ApiResponse<List<AlertResponse>> active() {
        return ApiResponse.ok(airKoreaService.activeAlerts());
    }
}
