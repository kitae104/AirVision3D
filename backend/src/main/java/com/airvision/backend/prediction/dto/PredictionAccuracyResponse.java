package com.airvision.backend.prediction.dto;

import java.time.Instant;
import java.util.List;

/**
 * 모델별 예측 vs 실측 정확도 리포트.
 * actual_pm25는 예측 실행 시점의 관측소 최신 관측값(간이 대조)이다.
 * 집계(mae·rmse·meanError·gradeAccuracy)는 모델 전체 건 기준이고,
 * points는 산점도용으로 모델당 최신 pointLimit건까지만 담는다.
 */
public record PredictionAccuracyResponse(
        int totalWithActual,
        int pointLimit,
        List<ModelAccuracy> models) {

    public record ModelAccuracy(
            String modelName,
            int count,
            double mae,
            double rmse,
            /** (예측-실측) 평균. 양수면 과대예측 경향 */
            double meanError,
            /** 예측·실측을 동일 기준으로 등급화했을 때 일치 비율 (0~1) */
            double gradeAccuracy,
            List<Point> points) {
    }

    public record Point(
            double predictedPm25,
            double actualPm25,
            Instant predictedAt,
            String siteName) {
    }
}
