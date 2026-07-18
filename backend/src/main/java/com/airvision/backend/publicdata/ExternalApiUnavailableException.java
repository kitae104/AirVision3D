package com.airvision.backend.publicdata;

/** 공공 API 연결 자체가 실패했을 때 (네트워크 오류, 타임아웃 등 → 502). */
public class ExternalApiUnavailableException extends RuntimeException {

    public ExternalApiUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
