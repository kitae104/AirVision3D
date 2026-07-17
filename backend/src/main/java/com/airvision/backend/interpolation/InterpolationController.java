package com.airvision.backend.interpolation;

import com.airvision.backend.common.ApiResponse;
import com.airvision.backend.common.PageResponse;
import com.airvision.backend.interpolation.dto.InterpolationRequest;
import com.airvision.backend.interpolation.dto.InterpolationResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Interpolation", description = "IDW 공간 보간 API")
@RestController
@RequestMapping("/api/interpolations")
public class InterpolationController {

    private final InterpolationService interpolationService;

    public InterpolationController(InterpolationService interpolationService) {
        this.interpolationService = interpolationService;
    }

    @Operation(summary = "IDW 보간 실행",
            description = "관측소별 최신 PM2.5를 기준으로 대상 위치들의 값을 보간하고 저장한다")
    @PostMapping("/run")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<List<InterpolationResponse>> run(
            @Valid @RequestBody InterpolationRequest request) {
        return ApiResponse.ok(interpolationService.run(request));
    }

    @Operation(summary = "보간 결과 목록 조회 (최신순)")
    @GetMapping
    public ApiResponse<PageResponse<InterpolationResponse>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.ok(interpolationService.findRecent(page, Math.min(size, 200)));
    }
}
