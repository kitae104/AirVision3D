package com.airvision.backend.publicdata.kma;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

/**
 * 기상청 단기예보 조회서비스 2.0 원본(JSON) 응답 구조.
 * (공공데이터포털 15084084 문서 기준, 2026-07-18 확인)
 */
public final class KmaRaw {

    private KmaRaw() {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Envelope(Response response) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Response(Header header, Body body) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Header(String resultCode, String resultMsg) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Body(Items items, Integer totalCount) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Items(List<Item> item) {
    }

    /** 실황(obsrValue)과 예보(fcstValue) 항목을 모두 수용한다. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Item(
            String baseDate,
            String baseTime,
            String category,
            Integer nx,
            Integer ny,
            String obsrValue,
            String fcstDate,
            String fcstTime,
            String fcstValue
    ) {
    }
}
