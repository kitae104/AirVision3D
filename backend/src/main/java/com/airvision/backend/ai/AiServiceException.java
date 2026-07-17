package com.airvision.backend.ai;

/** AI 서비스가 오류를 반환했을 때 (HTTP 400 등). */
public class AiServiceException extends RuntimeException {

    public AiServiceException(String message) {
        super(message);
    }

    public AiServiceException(String message, Throwable cause) {
        super(message, cause);
    }
}
