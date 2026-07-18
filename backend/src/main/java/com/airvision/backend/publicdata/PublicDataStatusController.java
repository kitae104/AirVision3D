package com.airvision.backend.publicdata;

import com.airvision.backend.common.ApiResponse;
import com.airvision.backend.publicdata.airkorea.AirKoreaService;
import com.airvision.backend.publicdata.kma.KmaWeatherService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 공공 데이터 연동 상태 (Mock 여부, 마지막 수집시각 등 — 대시보드 시스템 상태 카드용). */
@Tag(name = "Public Air Quality", description = "공공 대기질 (AirKorea) 연동 API")
@RestController
@RequestMapping("/api/public-data")
public class PublicDataStatusController {

    private final AirKoreaService airKoreaService;
    private final KmaWeatherService weatherService;

    public PublicDataStatusController(AirKoreaService airKoreaService,
                                      KmaWeatherService weatherService) {
        this.airKoreaService = airKoreaService;
        this.weatherService = weatherService;
    }

    @Operation(summary = "공공 데이터 연동 상태")
    @GetMapping("/status")
    public ApiResponse<Map<String, Object>> status() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("airkorea", airKoreaService.status());
        body.put("weather", weatherService.status());
        return ApiResponse.ok(body);
    }
}
