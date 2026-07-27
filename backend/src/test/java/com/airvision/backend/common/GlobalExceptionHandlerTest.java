package com.airvision.backend.common;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotWritableException;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void 클라이언트_연결_끊김이면_응답을_다시_쓰지_않는다() {
        // Tomcat/Jackson이 소켓 IOException을 래핑해 던지는 형태 재현
        HttpMessageNotWritableException e = new HttpMessageNotWritableException(
                "Could not write JSON: ServletOutputStream failed to write",
                new RuntimeException(new IOException(
                        "현재 연결은 사용자의 호스트 시스템의 소프트웨어의 의해 중단되었습니다")));

        assertThat(handler.handleNotWritable(e)).isNull();
    }

    @Test
    void 직접_IOException_원인도_연결_끊김으로_처리한다() {
        HttpMessageNotWritableException e = new HttpMessageNotWritableException(
                "Could not write JSON", new IOException("Broken pipe"));

        assertThat(handler.handleNotWritable(e)).isNull();
    }

    @Test
    void IOException이_아닌_직렬화_오류는_500으로_처리한다() {
        HttpMessageNotWritableException e = new HttpMessageNotWritableException(
                "Could not write JSON", new IllegalStateException("직렬화 실패"));

        ResponseEntity<ApiResponse<Void>> res = handler.handleNotWritable(e);

        assertThat(res).isNotNull();
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(res.getBody().success()).isFalse();
    }
}
