package com.airvision.backend.publicdata.odor.dto;

import java.time.Instant;
import java.util.List;

/** 악취 측정 현황 응답. failedOffices는 조회에 실패한 사업소명(부분 실패 허용). */
public record OdorResponse(
        boolean mock,
        boolean stale,
        Instant loadedAt,
        int spotCount,
        List<OdorSpotResponse> spots,
        List<String> failedOffices
) {
}
