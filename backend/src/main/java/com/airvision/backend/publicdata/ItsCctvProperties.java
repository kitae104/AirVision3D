package com.airvision.backend.publicdata;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * application.yml의 airvision.its 바인딩.
 * ITS 국가교통정보센터 실시간 도로 CCTV OpenAPI 연동 설정.
 * 키는 its.go.kr 오픈API 신청으로 발급 (공공데이터포털 키와 별개).
 */
@ConfigurationProperties(prefix = "airvision.its")
public record ItsCctvProperties(
        @DefaultValue("") String serviceKey,
        @DefaultValue("https://openapi.its.go.kr:9443") String baseUrl,
        @DefaultValue("300") long cacheSeconds
) {
}
