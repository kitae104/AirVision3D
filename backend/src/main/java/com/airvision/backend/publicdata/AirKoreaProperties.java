package com.airvision.backend.publicdata;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/** application.yml의 airvision.airkorea 바인딩. */
@ConfigurationProperties(prefix = "airvision.airkorea")
public record AirKoreaProperties(
        @DefaultValue("") String serviceKey,
        @DefaultValue("https://apis.data.go.kr/B552584") String baseUrl,
        @DefaultValue("인천") String defaultSido
) {
}
