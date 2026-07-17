package com.airvision.backend.ai;

/** AI 서비스에 연결할 수 없을 때 (HTTP 502로 매핑). */
public class AiServiceUnavailableException extends RuntimeException {

    public AiServiceUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
