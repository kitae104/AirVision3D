package com.airvision.backend.common;

/** 요청한 리소스가 존재하지 않을 때 발생시키는 예외 (HTTP 404로 매핑). */
public class NotFoundException extends RuntimeException {

    public NotFoundException(String resource, Object id) {
        super("%s을(를) 찾을 수 없습니다. (id=%s)".formatted(resource, id));
    }
}
