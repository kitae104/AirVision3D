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

    @ExceptionHandler(com.airvision.backend.auth.InvalidCredentialsException.class)
    public ResponseEntity<ApiResponse<Void>> handleInvalidCredentials(
            com.airvision.backend.auth.InvalidCredentialsException e) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(ApiResponse.error(e.getMessage()));
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

    @ExceptionHandler(com.airvision.backend.publicdata.ExternalApiException.class)
    public ResponseEntity<ApiResponse<Void>> handleExternalApiError(
            com.airvision.backend.publicdata.ExternalApiException e) {
        log.warn("공공 API 오류: {}", e.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body(ApiResponse.error(e.getMessage()));
    }

    @ExceptionHandler(com.airvision.backend.publicdata.ExternalApiUnavailableException.class)
    public ResponseEntity<ApiResponse<Void>> handleExternalApiUnavailable(
            com.airvision.backend.publicdata.ExternalApiUnavailableException e) {
        log.error("공공 API 연결 실패: {}", e.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body(ApiResponse.error(e.getMessage()));
    }

    @ExceptionHandler(com.airvision.backend.publicdata.PublicDataNotConfiguredException.class)
    public ResponseEntity<ApiResponse<Void>> handlePublicDataNotConfigured(
            com.airvision.backend.publicdata.PublicDataNotConfiguredException e) {
        log.warn("공공 API 미설정: {}", e.getMessage());
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(ApiResponse.error(e.getMessage()));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiResponse<Void>> handleConflict(DataIntegrityViolationException e) {
        log.warn("데이터 무결성 위반: {}", e.getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiResponse.error("중복되거나 참조 관계에 위배되는 데이터입니다."));
    }

    /**
     * 응답 JSON 전송 중 실패. 원인 체인에 IOException이 있으면 클라이언트(브라우저)가
     * 페이지 이동·새로고침·요청 취소로 연결을 먼저 끊은 것이므로 서버 장애가 아니다 —
     * 스택 없이 조용히 기록하고, 이미 끊긴 연결에는 응답을 다시 쓰지 않는다(null 반환).
     * IOException이 없으면(직렬화 버그 등) 실제 오류이므로 공통 500 처리로 넘긴다.
     */
    @ExceptionHandler(org.springframework.http.converter.HttpMessageNotWritableException.class)
    public ResponseEntity<ApiResponse<Void>> handleNotWritable(
            org.springframework.http.converter.HttpMessageNotWritableException e) {
        if (hasIoCause(e)) {
            log.debug("응답 전송 중 클라이언트가 연결을 끊었습니다 (새로고침/페이지 이동 추정): {}",
                    e.getMessage());
            return null;
        }
        return handleUnexpected(e);
    }

    private static boolean hasIoCause(Throwable e) {
        for (Throwable t = e.getCause(); t != null && t != t.getCause(); t = t.getCause()) {
            if (t instanceof java.io.IOException) {
                return true;
            }
        }
        return false;
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleUnexpected(Exception e) {
        log.error("처리되지 않은 오류", e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("서버 내부 오류가 발생했습니다."));
    }
}
