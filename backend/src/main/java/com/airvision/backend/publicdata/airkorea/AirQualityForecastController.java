package com.airvision.backend.publicdata.airkorea;

import com.airvision.backend.common.ApiResponse;
import com.airvision.backend.common.TtlCache;
import com.airvision.backend.publicdata.airkorea.dto.ForecastResponse;
import com.airvision.backend.publicdata.airkorea.dto.WeeklyForecastResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** AirKorea 대기질 예보 API (출처: 환경부·한국환경공단 AirKorea). */
@Tag(name = "Public Air Quality", description = "공공 대기질 (AirKorea) 연동 API")
@RestController
@RequestMapping("/api/air-quality/forecast")
public class AirQualityForecastController {

    private final AirKoreaService airKoreaService;

    public AirQualityForecastController(AirKoreaService airKoreaService) {
        this.airKoreaService = airKoreaService;
    }

    @Operation(summary = "대기질 예보통보 (오늘·내일·모레, informCode: PM10|PM25|O3)")
    @GetMapping
    public ApiResponse<Map<String, Object>> forecast(
            @RequestParam(defaultValue = "PM25") String informCode) {
        TtlCache.CachedValue<List<ForecastResponse>> cached =
                airKoreaService.forecast(informCode);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("informCode", informCode);
        body.put("stale", cached.stale());
        body.put("lastUpdatedAt", cached.loadedAt());
        body.put("forecasts", cached.value());
        return ApiResponse.ok(body);
    }

    @Operation(summary = "초미세먼지 주간예보")
    @GetMapping("/weekly")
    public ApiResponse<WeeklyForecastResponse> weekly() {
        return ApiResponse.ok(airKoreaService.weeklyForecast().value());
    }
}
