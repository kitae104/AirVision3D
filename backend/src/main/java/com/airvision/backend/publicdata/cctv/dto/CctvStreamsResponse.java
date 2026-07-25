package com.airvision.backend.publicdata.cctv.dto;

import java.time.Instant;
import java.util.List;

/**
 * 인천 핵심 3구 실시간 도로 CCTV 목록 (3D 지도 레이어용).
 * streamUrl은 HLS(m3u8) 주소이며 Mock 모드에서는 비어 있다.
 */
public record CctvStreamsResponse(
        boolean mock,
        boolean stale,
        Instant loadedAt,
        String source,
        int count,
        List<Camera> cameras
) {

    public record Camera(
            String name,
            String district,
            double latitude,
            double longitude,
            String streamUrl,
            String format
    ) {
    }
}
