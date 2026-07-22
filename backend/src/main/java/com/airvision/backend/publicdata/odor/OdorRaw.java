package com.airvision.backend.publicdata.odor;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;
import java.util.Map;

/**
 * odcloud(공공데이터포털 파일데이터 자동변환 API) 원본 응답.
 * data의 컬럼명은 데이터셋(사업소·연도)마다 조금씩 달라 Map으로 받고
 * {@link OdorNormalizer}가 키워드 기반으로 해석한다.
 */
public final class OdorRaw {

    private OdorRaw() {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Envelope(
            Integer page,
            Integer perPage,
            Integer totalCount,
            Integer currentCount,
            List<Map<String, Object>> data
    ) {
    }
}
