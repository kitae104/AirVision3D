package com.airvision.backend.site;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

/** 대시보드 구 필터 허용값 검증 로직. */
class DistrictsTest {

    @Test
    void validate_null이나_빈값은_전체를_뜻하는_null을_반환한다() {
        assertThat(Districts.validate(null)).isNull();
        assertThat(Districts.validate(" ")).isNull();
    }

    @Test
    void validate_허용된_구는_그대로_반환한다() {
        assertThat(Districts.validate("미추홀구")).isEqualTo("미추홀구");
        assertThat(Districts.validate("남동구")).isEqualTo("남동구");
        assertThat(Districts.validate("연수구")).isEqualTo("연수구");
    }

    @Test
    void validate_허용되지_않은_값은_IllegalArgumentException() {
        assertThatThrownBy(() -> Districts.validate("강남구"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("강남구");
    }
}
