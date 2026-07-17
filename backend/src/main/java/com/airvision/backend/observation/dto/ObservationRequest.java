package com.airvision.backend.observation.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;

/** 관측값 등록/수정 요청. */
public record ObservationRequest(
        @NotNull(message = "관측소 ID는 필수입니다")
        Long siteId,

        @NotNull(message = "관측 시각은 필수입니다")
        Instant observedAt,

        @DecimalMin(value = "0", message = "PM10은 0 이상이어야 합니다")
        Double pm10,

        @DecimalMin(value = "0", message = "PM2.5는 0 이상이어야 합니다")
        Double pm25,

        Double temperature,

        @DecimalMin(value = "0", message = "습도는 0 이상이어야 합니다")
        @DecimalMax(value = "100", message = "습도는 100 이하여야 합니다")
        Double humidity,

        @DecimalMin(value = "0", message = "풍속은 0 이상이어야 합니다")
        Double windSpeed,

        @DecimalMin(value = "0", message = "풍향은 0 이상이어야 합니다")
        @DecimalMax(value = "360", inclusive = false, message = "풍향은 360 미만이어야 합니다")
        Double windDirection
) {
}
