package com.airvision.backend.site.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** 관측소 등록/수정 요청. */
public record SiteRequest(
        @NotBlank(message = "관측소 이름은 필수입니다")
        @Size(max = 100)
        String name,

        @NotNull(message = "위도는 필수입니다")
        @DecimalMin(value = "-90", message = "위도는 -90 이상이어야 합니다")
        @DecimalMax(value = "90", message = "위도는 90 이하여야 합니다")
        Double latitude,

        @NotNull(message = "경도는 필수입니다")
        @DecimalMin(value = "-180", message = "경도는 -180 이상이어야 합니다")
        @DecimalMax(value = "180", message = "경도는 180 이하여야 합니다")
        Double longitude,

        Double altitude,

        @Size(max = 30)
        String siteType,

        String description
) {
}
