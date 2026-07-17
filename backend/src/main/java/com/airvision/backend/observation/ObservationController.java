package com.airvision.backend.observation;

import com.airvision.backend.common.ApiResponse;
import com.airvision.backend.common.PageResponse;
import com.airvision.backend.observation.dto.ObservationRequest;
import com.airvision.backend.observation.dto.ObservationResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.time.Instant;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Observations", description = "관측값 관리 API")
@RestController
@RequestMapping("/api/observations")
public class ObservationController {

    private final ObservationService observationService;

    public ObservationController(ObservationService observationService) {
        this.observationService = observationService;
    }

    @Operation(summary = "관측값 목록 조회 (관측소/기간 필터, 페이지네이션)")
    @GetMapping
    public ApiResponse<PageResponse<ObservationResponse>> search(
            @RequestParam(required = false) Long siteId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.ok(observationService.search(siteId, from, to, page, Math.min(size, 200)));
    }

    @Operation(summary = "관측값 상세 조회")
    @GetMapping("/{id}")
    public ApiResponse<ObservationResponse> get(@PathVariable Long id) {
        return ApiResponse.ok(observationService.findById(id));
    }

    @Operation(summary = "관측값 등록")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ObservationResponse> create(@Valid @RequestBody ObservationRequest request) {
        return ApiResponse.ok(observationService.create(request));
    }

    @Operation(summary = "관측값 수정")
    @PutMapping("/{id}")
    public ApiResponse<ObservationResponse> update(@PathVariable Long id,
                                                   @Valid @RequestBody ObservationRequest request) {
        return ApiResponse.ok(observationService.update(id, request));
    }

    @Operation(summary = "관측값 삭제")
    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        observationService.delete(id);
        return ApiResponse.ok(null);
    }
}
