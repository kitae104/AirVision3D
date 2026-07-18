package com.airvision.backend.publicdata;

/** 서비스키 미설정 + Mock 비활성 상태에서 공공 API 기능을 호출했을 때 (→ 503). */
public class PublicDataNotConfiguredException extends RuntimeException {

    public PublicDataNotConfiguredException(String message) {
        super(message);
    }
}
