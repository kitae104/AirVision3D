package com.airvision.backend.publicdata;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/** application.yml의 airvision.public-data 바인딩 (Mock·캐시·비교 정책). */
@ConfigurationProperties(prefix = "airvision.public-data")
public record PublicDataProperties(
        @DefaultValue("auto") String mockEnabled,
        @DefaultValue Cache cache,
        @DefaultValue Comparison comparison
) {

    public record Cache(
            @DefaultValue("1800") long realtimeSeconds,
            @DefaultValue("86400") long stationsSeconds,
            @DefaultValue("3600") long forecastSeconds,
            @DefaultValue("1800") long alertsSeconds,
            @DefaultValue("1800") long weatherSeconds
    ) {
    }

    public record Comparison(
            @DefaultValue("5") double maxDistanceKm,
            @DefaultValue("60") long maxMinutes
    ) {
    }

    /**
     * Mock 모드 활성 여부.
     * auto: 서비스키가 비어 있으면 Mock (실키 입력 시 자동 비활성화)
     * true / false: 강제 지정
     */
    public boolean mockActive(String serviceKey) {
        return switch (mockEnabled == null ? "auto" : mockEnabled.trim().toLowerCase()) {
            case "true" -> true;
            case "false" -> false;
            default -> serviceKey == null || serviceKey.isBlank()
                    || serviceKey.startsWith("your_");
        };
    }
}
