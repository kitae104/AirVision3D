package com.airvision.backend.publicdata.airkorea.dto;

import com.airvision.backend.publicdata.airkorea.AirKoreaNormalizer;

/**
 * 오염물질 측정값 (정규화 응답).
 * valid=false면 value는 null이고 status로 사유(NO_DATA/COMM_ERROR/...)를 구분한다.
 */
public record PollutantValue(
        Double value,
        String unit,
        String grade,
        boolean valid,
        String status
) {

    public static PollutantValue of(AirKoreaNormalizer.Measured measured,
                                    String gradeCode, String unit) {
        return new PollutantValue(measured.value(), unit,
                AirKoreaNormalizer.gradeLabel(gradeCode), measured.valid(), measured.status());
    }
}
