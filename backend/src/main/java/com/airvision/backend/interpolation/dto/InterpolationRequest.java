package com.airvision.backend.interpolation.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;

/**
 * IDW 보간 실행 요청.
 * 관측지점(sources)은 DB의 관측소별 최신 PM2.5 관측값을 사용한다.
 *
 * @param observedAt 기준 시각 (null이면 현재 시각 기준 최신 관측값 사용)
 * @param power      거리 가중치 지수 p (기본 2.0)
 * @param method     보간 방법 (IDW=일반, MODIFIED_IDW=보고서 보정 가중치 방식, 기본 IDW)
 * @param targets    보간 대상 위치 목록
 */
public record InterpolationRequest(
        Instant observedAt,

        @DecimalMin(value = "0.1", message = "p는 0.1 이상이어야 합니다")
        @DecimalMax(value = "10", message = "p는 10 이하여야 합니다")
        Double power,

        @Pattern(regexp = "IDW|MODIFIED_IDW", message = "method는 IDW 또는 MODIFIED_IDW여야 합니다")
        String method,

        @NotEmpty(message = "보간 대상 위치는 1개 이상이어야 합니다")
        @Size(max = 500, message = "보간 대상 위치는 500개 이하여야 합니다")
        List<@Valid Target> targets
) {

    public record Target(
            @Size(max = 100)
            String name,

            @NotNull(message = "위도는 필수입니다")
            @DecimalMin(value = "-90") @DecimalMax(value = "90")
            Double latitude,

            @NotNull(message = "경도는 필수입니다")
            @DecimalMin(value = "-180") @DecimalMax(value = "180")
            Double longitude
    ) {
    }

    public double powerOrDefault() {
        return power != null ? power : 2.0;
    }

    public String methodOrDefault() {
        return method != null && !method.isBlank() ? method : "IDW";
    }
}
