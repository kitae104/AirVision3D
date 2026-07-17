package com.airvision.backend.site;

import com.airvision.backend.common.ApiResponse;
import com.airvision.backend.site.dto.SiteRequest;
import com.airvision.backend.site.dto.SiteResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Observation Sites", description = "관측소 관리 API")
@RestController
@RequestMapping("/api/sites")
public class SiteController {

    private final SiteService siteService;

    public SiteController(SiteService siteService) {
        this.siteService = siteService;
    }

    @Operation(summary = "관측소 목록 조회")
    @GetMapping
    public ApiResponse<List<SiteResponse>> list() {
        return ApiResponse.ok(siteService.findAll());
    }

    @Operation(summary = "관측소 상세 조회 (PostGIS geom WKT 포함)")
    @GetMapping("/{id}")
    public ApiResponse<SiteResponse> get(@PathVariable Long id) {
        return ApiResponse.ok(siteService.findById(id));
    }

    @Operation(summary = "관측소 등록")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<SiteResponse> create(@Valid @RequestBody SiteRequest request) {
        return ApiResponse.ok(siteService.create(request));
    }

    @Operation(summary = "관측소 수정")
    @PutMapping("/{id}")
    public ApiResponse<SiteResponse> update(@PathVariable Long id,
                                            @Valid @RequestBody SiteRequest request) {
        return ApiResponse.ok(siteService.update(id, request));
    }

    @Operation(summary = "관측소 삭제")
    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        siteService.delete(id);
        return ApiResponse.ok(null);
    }
}
