package com.airvision.backend.publicdata.airkorea.dto;

import java.time.Instant;

/** 미세먼지 경보 발령 1건 (정규화 응답). active=true면 아직 해제되지 않은 경보. */
public record AlertResponse(
        String districtName,
        String moveName,
        String itemCode,
        String issueLevel,
        Instant issuedAt,
        Double issueValue,
        Instant clearedAt,
        Double clearValue,
        boolean active
) {
}
