package com.airvision.backend.publicdata.airkorea;

import com.airvision.backend.common.ApiResponse;
import com.airvision.backend.publicdata.airkorea.dto.PublicStationResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** AirKorea 측정소 조회 API (출처: 환경부·한국환경공단 AirKorea). */
@Tag(name = "Public Air Quality", description = "공공 대기질 (AirKorea) 연동 API")
@RestController
@RequestMapping("/api/air-quality/stations")
public class AirQualityStationController {

    private final AirKoreaService airKoreaService;

    public AirQualityStationController(AirKoreaService airKoreaService) {
        this.airKoreaService = airKoreaService;
    }

    @Operation(summary = "측정소 목록 (주소·측정소명 검색)")
    @GetMapping
    public ApiResponse<List<PublicStationResponse>> list(
            @RequestParam(required = false) String addr,
            @RequestParam(required = false) String stationName) {
        return ApiResponse.ok(airKoreaService.searchStations(addr, stationName));
    }

    @Operation(summary = "좌표 기준 근접 측정소 (거리 오름차순)")
    @GetMapping("/nearby")
    public ApiResponse<List<PublicStationResponse>> nearby(
            @RequestParam double latitude,
            @RequestParam double longitude,
            @RequestParam(defaultValue = "10") double radiusKm) {
        return ApiResponse.ok(airKoreaService.nearbyStations(latitude, longitude, radiusKm));
    }
}
