package com.airvision.backend.publicdata.history;

import com.airvision.backend.common.ApiResponse;
import com.airvision.backend.publicdata.history.dto.MeasurementHourlyPoint;
import com.airvision.backend.publicdata.history.dto.MeasurementSeriesPoint;
import com.airvision.backend.publicdata.history.dto.PublicStationSeries;
import com.airvision.backend.publicdata.history.dto.WeatherSeriesPoint;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 누적된 공공 데이터 시계열 조회 API. */
@Tag(name = "Public Data History", description = "공공 데이터 누적 시계열 조회")
@RestController
@RequestMapping("/api/public-data/history")
public class PublicDataHistoryController {

    private final PublicDataHistoryService historyService;

    public PublicDataHistoryController(PublicDataHistoryService historyService) {
        this.historyService = historyService;
    }

    @Operation(summary = "누적 실측 시간별 평균 (sido 생략=전체)")
    @GetMapping("/measurements/hourly")
    public ApiResponse<List<MeasurementHourlyPoint>> hourly(
            @RequestParam(required = false) String sido,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to) {
        return ApiResponse.ok(historyService.hourly(sido, from, to));
    }

    @Operation(summary = "측정소별 누적 실측 시계열")
    @GetMapping("/measurements")
    public ApiResponse<List<MeasurementSeriesPoint>> stationSeries(
            @RequestParam String stationName,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to) {
        return ApiResponse.ok(historyService.stationSeries(stationName, from, to));
    }

    @Operation(summary = "시도 내 측정소별 누적 실측 시계열 (좌표 포함, 3D 지도 재생용)")
    @GetMapping("/measurements/series")
    public ApiResponse<List<PublicStationSeries>> regionSeries(
            @RequestParam String sido,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to) {
        return ApiResponse.ok(historyService.regionSeries(sido, from, to));
    }

    @Operation(summary = "시도별 누적 기상 시계열")
    @GetMapping("/weather")
    public ApiResponse<List<WeatherSeriesPoint>> weatherSeries(
            @RequestParam String sido,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to) {
        return ApiResponse.ok(historyService.weatherSeries(sido, from, to));
    }

    @Operation(summary = "누적 현황 요약 (건수·최초 수집시각)")
    @GetMapping("/summary")
    public ApiResponse<Map<String, Object>> summary() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("accumulatedCount", historyService.accumulatedCount());
        body.put("earliestCollectedAt", historyService.earliestCollectedAt());
        return ApiResponse.ok(body);
    }
}
