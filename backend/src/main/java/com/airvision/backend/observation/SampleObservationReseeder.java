package com.airvision.backend.observation;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.util.StreamUtils;

/**
 * 데모/시연용 합성 관측값을 현재 시각 기준 최근 7일 구간으로 다시 채운다.
 *
 * <p>정적 시드(V2__seed_sample_data.sql)는 마이그레이션이 처음 적용된 시점 기준으로만
 * 데이터를 생성하므로, 시간이 지나면 대시보드의 24시간 조회 창을 벗어난다. 이 리시더는
 * 삭제 없이 빠진 시간대만 채워(ON CONFLICT DO NOTHING) 실사용 데이터를 훼손하지 않는다.</p>
 *
 * <p>동작 모드 (2026-07-26, 대시보드 차트 공백 재발로 자동 보충 기본 활성화):</p>
 * <ul>
 *   <li><b>자동 보충(기본)</b> — {@code airvision.sample.auto-reseed=true}(기본값)면
 *       기동 직후와 매시 5분에 빠진 시간대를 보충해 24시간 차트가 비지 않게 유지한다.
 *       합성 데이터 자동 생성을 원치 않으면 .env에 {@code SAMPLE_AUTO_RESEED=false}.</li>
 *   <li><b>일회성</b> — 자동 보충을 꺼 둔 상태에서 시연 전 최신화가 필요할 때:
 *       {@code .\gradlew.bat bootRun --args='--airvision.sample.reseed=true'}</li>
 * </ul>
 */
@Component
public class SampleObservationReseeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(SampleObservationReseeder.class);
    private static final String SQL_RESOURCE = "sql/reseed_sample_observations.sql";

    private final JdbcTemplate jdbcTemplate;
    private final boolean enabled;
    private final boolean autoEnabled;

    public SampleObservationReseeder(JdbcTemplate jdbcTemplate,
                                     @Value("${airvision.sample.reseed:false}") boolean enabled,
                                     @Value("${airvision.sample.auto-reseed:true}")
                                     boolean autoEnabled) {
        this.jdbcTemplate = jdbcTemplate;
        this.enabled = enabled;
        this.autoEnabled = autoEnabled;
    }

    @Override
    public void run(String... args) {
        if (!enabled && !autoEnabled) {
            return;
        }
        reseed("기동 시");
    }

    /** 매시 5분에 빠진 시간대 보충 (자동 보충 모드일 때만). */
    @Scheduled(cron = "${airvision.sample.auto-reseed-cron:0 5 * * * *}")
    public void scheduledTopUp() {
        if (!autoEnabled) {
            return;
        }
        reseed("정기 보충");
    }

    private void reseed(String reason) {
        int inserted = jdbcTemplate.update(loadSql());
        log.info("샘플 관측값 리시드({}) 완료: {}개 시간대 추가 (현재 시각 기준 최근 7일, 기존 데이터 유지)",
                reason, inserted);
    }

    private String loadSql() {
        try {
            return StreamUtils.copyToString(
                    new ClassPathResource(SQL_RESOURCE).getInputStream(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("리시드 SQL을 불러오지 못했습니다: " + SQL_RESOURCE, e);
        }
    }
}
