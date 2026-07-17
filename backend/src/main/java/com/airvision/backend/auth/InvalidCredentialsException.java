package com.airvision.backend.auth;

/** 아이디 또는 비밀번호 불일치 (HTTP 401로 매핑). */
public class InvalidCredentialsException extends RuntimeException {

    public InvalidCredentialsException() {
        super("아이디 또는 비밀번호가 올바르지 않습니다");
    }
}
