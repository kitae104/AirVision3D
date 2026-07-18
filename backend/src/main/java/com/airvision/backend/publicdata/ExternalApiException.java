package com.airvision.backend.publicdata;

/** 공공 API가 오류 응답(인증 실패, 잘못된 파라미터, 형식 변경 등)을 반환했을 때. */
public class ExternalApiException extends RuntimeException {

    public ExternalApiException(String message) {
        super(message);
    }

    public ExternalApiException(String message, Throwable cause) {
        super(message, cause);
    }
}
