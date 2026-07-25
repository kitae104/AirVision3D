package com.airvision.backend.publicdata.cctv;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

/**
 * ITS 국가교통정보센터 CCTV OpenAPI 원본 응답 구조.
 * 좌표(coordx/coordy)는 숫자·문자열이 혼재해 문자열로 받아 서비스에서 파싱한다.
 */
public final class CctvRaw {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Envelope(Response response) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Response(List<Item> data, Integer datacount) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Item(
            String cctvname,
            String cctvurl,
            String cctvformat,
            String cctvtype,
            String coordx,
            String coordy) {
    }

    private CctvRaw() {
    }
}
