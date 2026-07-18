package com.airvision.backend.observation;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class SampleObservationReseederTest {

    @Test
    void 비활성이면_DB를_건드리지_않는다() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);

        new SampleObservationReseeder(jdbcTemplate, false).run();

        verifyNoInteractions(jdbcTemplate);
    }

    @Test
    void 활성이면_리시드_SQL을_한_번_실행한다() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        when(jdbcTemplate.update(anyString())).thenReturn(48);

        new SampleObservationReseeder(jdbcTemplate, true).run();

        // 최근 7일 관측값 INSERT(멱등, ON CONFLICT DO NOTHING) SQL이 실행된다
        verify(jdbcTemplate).update(contains("INSERT INTO observations"));
    }
}
