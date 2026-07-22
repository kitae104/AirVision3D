package com.airvision.backend.publicdata.interpolation;

import com.airvision.backend.common.ApiResponse;
import com.airvision.backend.publicdata.interpolation.dto.IdwGridResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 공공 실측 기반 IDW 격자 표면 API. */
@Tag(name = "Public Air Quality", description = "공공 대기질 (AirKorea) 연동 API")
@RestController
@RequestMapping("/api/air-quality/interpolation")
public class PublicIdwController {

    private final PublicIdwService service;

    public PublicIdwController(PublicIdwService service) {
        this.service = service;
    }

    @Operation(summary = "공공 실측 기반 IDW 격자 표면 (현재 PM2.5)",
            description = "method=IDW(기본) 또는 MODIFIED_IDW(보정 가중치, 최종보고서 알고리즘)")
    @GetMapping("/grid")
    public ApiResponse<IdwGridResponse> grid(
            @RequestParam(required = false) String sido,
            @RequestParam(required = false) Double power,
            @RequestParam(required = false) Integer resolution,
            @RequestParam(required = false) String method) {
        return ApiResponse.ok(service.grid(sido, power, resolution, method));
    }
}
