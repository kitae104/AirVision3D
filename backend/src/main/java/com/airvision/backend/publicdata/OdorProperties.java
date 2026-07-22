package com.airvision.backend.publicdata;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * application.yml의 airvision.odor 바인딩.
 * 인천환경공단 악취 측정 데이터(공공데이터포털 파일데이터 자동변환 OpenAPI, odcloud) 연동 설정.
 * 데이터셋은 사업소 단위로 등록한다 (연 1회 개방 자료 — 실시간 아님).
 */
@ConfigurationProperties(prefix = "airvision.odor")
public record OdorProperties(
        @DefaultValue("") String serviceKey,
        @DefaultValue("https://api.odcloud.kr/api") String baseUrl,
        @DefaultValue("86400") long cacheSeconds,
        @DefaultValue("500") int perPage,
        List<Dataset> datasets
) {

    /** 사업소별 데이터셋. path는 odcloud 경로, fixture는 Mock 모드용 파일명. */
    public record Dataset(String office, String path, String fixture) {
    }

    public List<Dataset> datasetsOrEmpty() {
        return datasets == null ? List.of() : datasets;
    }
}
