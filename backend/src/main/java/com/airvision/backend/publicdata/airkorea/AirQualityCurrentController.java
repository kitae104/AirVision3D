package com.airvision.backend.publicdata.airkorea;

import com.airvision.backend.common.ApiResponse;
import com.airvision.backend.publicdata.airkorea.dto.CurrentAirQualityResponse;
import com.airvision.backend.publicdata.airkorea.dto.StationAirQuality;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** AirKorea 실시간 대기질 API (출처: 환경부·한국환경공단 AirKorea). */
@Tag(name = "Public Air Quality", description = "공공 대기질 (AirKorea) 연동 API")
@RestController
@RequestMapping("/api/air-quality/current")
public class AirQualityCurrentController {

    private final AirKoreaService airKoreaService;

    public AirQualityCurrentController(AirKoreaService airKoreaService) {
        this.airKoreaService = airKoreaService;
    }

    @Operation(summary = "시도별 실시간 대기질 (측정소 좌표 포함, 3D 지도용)")
    @GetMapping
    public ApiResponse<CurrentAirQualityResponse> current(
            @RequestParam(required = false) String sido) {
        return ApiResponse.ok(airKoreaService.current(sido));
    }

    @Operation(summary = "측정소별 실시간 대기질")
    @GetMapping("/stations/{stationName}")
    public ApiResponse<StationAirQuality> byStation(
            @PathVariable String stationName,
            @RequestParam(required = false) String sido) {
        return ApiResponse.ok(airKoreaService.currentByStation(stationName, sido));
    }

    @Operation(summary = "시도별 실시간 대기질 (경로 변수 형태)")
    @GetMapping("/regions/{sido}")
    public ApiResponse<CurrentAirQualityResponse> byRegion(@PathVariable String sido) {
        return ApiResponse.ok(airKoreaService.current(sido));
    }
}
