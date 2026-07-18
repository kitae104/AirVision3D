package com.airvision.backend.publicdata.kma;

import com.airvision.backend.common.ApiResponse;
import com.airvision.backend.publicdata.kma.dto.WeatherForecastResponse;
import com.airvision.backend.publicdata.kma.dto.WeatherNowResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 기상 정보 API (출처: 기상청 단기예보 조회서비스 2.0). */
@Tag(name = "Weather", description = "기상청 기상 데이터 연동 API")
@RestController
@RequestMapping("/api/weather")
public class WeatherController {

    private final KmaWeatherService weatherService;

    public WeatherController(KmaWeatherService weatherService) {
        this.weatherService = weatherService;
    }

    @Operation(summary = "좌표 기준 현재 기상 (초단기실황)")
    @GetMapping("/current")
    public ApiResponse<WeatherNowResponse> current(
            @RequestParam double latitude,
            @RequestParam double longitude) {
        return ApiResponse.ok(weatherService.current(latitude, longitude));
    }

    @Operation(summary = "좌표 기준 6시간 기상 예보 (초단기예보)")
    @GetMapping("/forecast")
    public ApiResponse<WeatherForecastResponse> forecast(
            @RequestParam double latitude,
            @RequestParam double longitude) {
        return ApiResponse.ok(weatherService.forecast(latitude, longitude));
    }

    @Operation(summary = "AirKorea 측정소 좌표 기준 현재 기상")
    @GetMapping("/stations/{stationName}")
    public ApiResponse<WeatherNowResponse> byStation(@PathVariable String stationName) {
        return ApiResponse.ok(weatherService.byStation(stationName));
    }
}
