package com.airvision.backend.publicdata.collector;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/** application.yml의 airvision.public-data.collection 바인딩 (수집 스케줄·범위·보존). */
@ConfigurationProperties(prefix = "airvision.public-data.collection")
public record CollectionProperties(
        @DefaultValue("true") boolean enabled,
        @DefaultValue("0 10 * * * *") String cron,
        @DefaultValue("0 30 3 * * *") String cleanupCron,
        @DefaultValue("180") int retentionDays,
        @DefaultValue("true") boolean collectOnStartup,
        @DefaultValue({"서울", "인천", "경기"}) List<String> sidos,
        @DefaultValue List<WeatherPoint> weatherPoints
) {

    public record WeatherPoint(String sido, double latitude, double longitude) {
    }
}
