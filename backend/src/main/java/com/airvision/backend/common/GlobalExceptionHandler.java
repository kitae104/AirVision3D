package com.airvision.backend.common;

import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** 모든 컨트롤러의 예외를 공통 응답 형식으로 변환한다. */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNotFound(NotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error(e.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidation(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .map(err -> "%s: %s".formatted(err.getField(), err.getDefaultMessage()))
                .collect(Collectors.joining(", "));
        return ResponseEntity.badRequest().body(ApiResponse.error("입력값이 올바르지 않습니다. " + message));
    }

    @ExceptionHandler({IllegalArgumentException.class, IllegalStateException.class})
    public ResponseEntity<ApiResponse<Void>> handleBadState(RuntimeException e) {
        return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
    }

    @ExceptionHandler(jakarta.validation.ConstraintViolationException.class)
    public ResponseEntity<ApiResponse<Void>> handleConstraintViolation(
            jakarta.validation.ConstraintViolationException e) {
        return ResponseEntity.badRequest()
                .body(ApiResponse.error("입력값이 올바르지 않습니다. " + e.getMessage()));
    }

    @ExceptionHandler({
            org.springframework.web.bind.ServletRequestBindingException.class,
            org.springframework.web.multipart.support.MissingServletRequestPartException.class,
            org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class})
    public ResponseEntity<ApiResponse<Void>> handleBadRequest(Exception e) {
        return ResponseEntity.badRequest()
                .body(ApiResponse.error("요청 파라미터가 올바르지 않습니다. " + e.getMessage()));
    }

    @ExceptionHandler(com.airvision.backend.ai.AiServiceException.class)
    public ResponseEntity<ApiResponse<Void>> handleAiServiceError(
            com.airvision.backend.ai.AiServiceException e) {
        log.warn("AI 서비스 오류: {}", e.getMessage());
        return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
    }

    @ExceptionHandler(com.airvision.backend.ai.AiServiceUnavailableException.class)
    public ResponseEntity<ApiResponse<Void>> handleAiServiceUnavailable(
            com.airvision.backend.ai.AiServiceUnavailableException e) {
        log.error("AI 서비스 연결 실패: {}", e.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body(ApiResponse.error(e.getMessage()));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiResponse<Void>> handleConflict(DataIntegrityViolationException e) {
        log.warn("데이터 무결성 위반: {}", e.getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiResponse.error("중복되거나 참조 관계에 위배되는 데이터입니다."));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleUnexpected(Exception e) {
        log.error("처리되지 않은 오류", e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("서버 내부 오류가 발생했습니다."));
    }
}
