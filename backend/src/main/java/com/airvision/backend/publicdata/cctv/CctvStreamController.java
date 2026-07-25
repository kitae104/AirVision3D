package com.airvision.backend.publicdata.cctv;

import com.airvision.backend.common.ApiResponse;
import com.airvision.backend.publicdata.cctv.dto.CctvStreamsResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "CCTV", description = "실시간 도로 CCTV API (ITS 국가교통정보센터, 인천 핵심 3구)")
@RestController
@RequestMapping("/api/cctv")
public class CctvStreamController {

    private final CctvStreamService cctvStreamService;

    public CctvStreamController(CctvStreamService cctvStreamService) {
        this.cctvStreamService = cctvStreamService;
    }

    @Operation(summary = "인천 미추홀·남동·연수구 실시간 CCTV 목록 (HLS 스트림 주소 포함)")
    @GetMapping("/streams")
    public ApiResponse<CctvStreamsResponse> streams() {
        return ApiResponse.ok(cctvStreamService.streams());
    }
}
