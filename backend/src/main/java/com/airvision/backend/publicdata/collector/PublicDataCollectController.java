package com.airvision.backend.publicdata.collector;

import com.airvision.backend.common.ApiResponse;
import com.airvision.backend.publicdata.collector.dto.CollectionResult;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 수동 수집 트리거 (ADMIN — POST /api/** 규칙). 데모 시 즉시 1회 수집용. */
@Tag(name = "Public Data History", description = "공공 데이터 누적 시계열 조회")
@RestController
@RequestMapping("/api/public-data")
public class PublicDataCollectController {

    private final PublicDataCollector collector;

    public PublicDataCollectController(PublicDataCollector collector) {
        this.collector = collector;
    }

    @Operation(summary = "공공 데이터 1회 수동 수집")
    @PostMapping("/collect")
    public ApiResponse<CollectionResult> collect() {
        return ApiResponse.ok(collector.collectOnce());
    }
}
