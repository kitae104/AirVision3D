package com.airvision.backend.prediction.dto;

import com.airvision.backend.prediction.Prediction;
import java.time.Instant;

/** AI 예측 결과 응답. */
public record PredictionResponse(
        Long id,
        Long siteId,
        String siteName,
        Long imageId,
        String modelName,
        Instant predictedAt,
        Double actualPm25,
        double predictedPm25,
        String predictedGrade,
        Instant createdAt
) {

    public static PredictionResponse from(Prediction p) {
        return new PredictionResponse(
                p.getId(),
                p.getSite().getId(),
                p.getSite().getName(),
                p.getImageId(),
                p.getModel().getModelName(),
                p.getPredictedAt(),
                p.getActualPm25(),
                p.getPredictedPm25(),
                p.getPredictedGrade(),
                p.getCreatedAt()
        );
    }
}
