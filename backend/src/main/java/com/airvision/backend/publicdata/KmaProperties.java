package com.airvision.backend.publicdata;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/** application.yml의 airvision.kma 바인딩 (기상청 단기예보 2.0). */
@ConfigurationProperties(prefix = "airvision.kma")
public record KmaProperties(
        @DefaultValue("") String serviceKey,
        @DefaultValue("https://apis.data.go.kr/1360000") String baseUrl
) {
}
