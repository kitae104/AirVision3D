package com.airvision.backend.common;

import java.time.Instant;

/**
 * 모든 REST API가 공통으로 사용하는 응답 래퍼.
 * 형식: { "success": true, "data": {}, "message": null, "timestamp": "ISO-8601" }
 */
public record ApiResponse<T>(
        boolean success,
        T data,
        String message,
        Instant timestamp
) {

    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(true, data, null, Instant.now());
    }

    public static <T> ApiResponse<T> error(String message) {
        return new ApiResponse<>(false, null, message, Instant.now());
    }
}
