package com.airvision.backend.site;

import java.util.List;

/** 대시보드 구 단위 필터 허용값 (프로젝트 핵심 대상지: 인천 핵심 3구). */
public final class Districts {

    public static final List<String> ALLOWED = List.of("미추홀구", "남동구", "연수구");

    private Districts() {
    }

    /** null/공백이면 전체(null), 허용 목록이면 그대로 반환. 그 외는 400으로 매핑되는 예외. */
    public static String validate(String district) {
        if (district == null || district.isBlank()) {
            return null;
        }
        if (!ALLOWED.contains(district)) {
            throw new IllegalArgumentException(
                    "지원하지 않는 지역입니다: %s (허용: %s)".formatted(district, String.join(", ", ALLOWED)));
        }
        return district;
    }
}
