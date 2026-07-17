package com.airvision.backend.interpolation.dto;

import com.airvision.backend.interpolation.InterpolationResult;
import java.time.Instant;

/** IDW 보간 결과 응답. */
public record InterpolationResponse(
        Long id,
        String targetName,
        double latitude,
        double longitude,
        double pm25,
        String algorithm,
        double power,
        String sourceType,
        Instant interpolatedAt
) {

    public static InterpolationResponse from(InterpolationResult r) {
        return new InterpolationResponse(
                r.getId(),
                r.getTargetName(),
                r.getLatitude(),
                r.getLongitude(),
                r.getPm25(),
                r.getAlgorithm(),
                r.getPower(),
                r.getSourceType(),
                r.getInterpolatedAt()
        );
    }
}
