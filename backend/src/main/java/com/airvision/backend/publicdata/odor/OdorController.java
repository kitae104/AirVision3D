package com.airvision.backend.publicdata.odor;

import com.airvision.backend.common.ApiResponse;
import com.airvision.backend.publicdata.odor.dto.OdorResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Odor", description = "악취 모니터링 API (인천환경공단 사업소 주변 복합악취 측정)")
@RestController
@RequestMapping("/api/odor")
public class OdorController {

    private final OdorService odorService;

    public OdorController(OdorService odorService) {
        this.odorService = odorService;
    }

    @Operation(summary = "악취 측정 현황 (사업소·측정지점 단위 집계, 연 단위 개방 자료)")
    @GetMapping("/measurements")
    public ApiResponse<OdorResponse> measurements() {
        return ApiResponse.ok(odorService.measurements());
    }
}
