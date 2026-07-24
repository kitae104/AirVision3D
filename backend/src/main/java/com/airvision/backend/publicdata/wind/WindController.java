package com.airvision.backend.publicdata.wind;

import com.airvision.backend.common.ApiResponse;
import com.airvision.backend.publicdata.wind.dto.AdvectionResponse;
import com.airvision.backend.publicdata.wind.dto.WindFieldResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 바람장·이류 예측 API (출처: 기상청 초단기예보 + AirKorea 실측). */
@Tag(name = "Wind", description = "인천권 바람장과 PM2.5 이동 예측 API")
@RestController
@RequestMapping("/api/wind")
public class WindController {

    private final WindFieldService windFieldService;
    private final AdvectionService advectionService;

    public WindController(WindFieldService windFieldService, AdvectionService advectionService) {
        this.windFieldService = windFieldService;
        this.advectionService = advectionService;
    }

    @Operation(summary = "인천권 시간별 바람장 (25×25 격자, 최대 +6시간)")
    @GetMapping("/field")
    public ApiResponse<WindFieldResponse> field() {
        return ApiResponse.ok(windFieldService.field());
    }

    @Operation(summary = "PM2.5·PM10 단순 이류 예측 (advection-only, 1~6시간)")
    @GetMapping("/advection")
    public ApiResponse<AdvectionResponse> advection(
            @RequestParam(defaultValue = "6") int hours) {
        return ApiResponse.ok(advectionService.advect(hours));
    }
}
