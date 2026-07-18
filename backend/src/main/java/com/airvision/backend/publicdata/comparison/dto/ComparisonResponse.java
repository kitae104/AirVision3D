package com.airvision.backend.publicdata.comparison.dto;

import java.util.List;

/** AI 추정 vs 공공 실측 비교 묶음 (매칭 정책 값 포함). */
public record ComparisonResponse(
        double maxDistanceKm,
        long maxMinutes,
        String sido,
        boolean mock,
        List<ComparisonRow> rows
) {
}
