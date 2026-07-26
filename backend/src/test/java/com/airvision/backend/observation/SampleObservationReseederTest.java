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
    void 모두_비활성이면_DB를_건드리지_않는다() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        SampleObservationReseeder reseeder =
                new SampleObservationReseeder(jdbcTemplate, false, false);

        reseeder.run();
        reseeder.scheduledTopUp();

        verifyNoInteractions(jdbcTemplate);
    }

    @Test
    void 일회성_플래그가_켜지면_기동_시_리시드_SQL을_실행한다() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        when(jdbcTemplate.update(anyString())).thenReturn(48);

        new SampleObservationReseeder(jdbcTemplate, true, false).run();

        // 최근 7일 관측값 INSERT(멱등, ON CONFLICT DO NOTHING) SQL이 실행된다
        verify(jdbcTemplate).update(contains("INSERT INTO observations"));
    }

    @Test
    void 자동_보충_모드면_기동_시_리시드를_실행한다() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        when(jdbcTemplate.update(anyString())).thenReturn(24);

        new SampleObservationReseeder(jdbcTemplate, false, true).run();

        verify(jdbcTemplate).update(contains("INSERT INTO observations"));
    }

    @Test
    void 자동_보충_모드면_정기_보충도_리시드를_실행한다() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        when(jdbcTemplate.update(anyString())).thenReturn(1);

        new SampleObservationReseeder(jdbcTemplate, false, true).scheduledTopUp();

        verify(jdbcTemplate).update(contains("INSERT INTO observations"));
    }

    @Test
    void 자동_보충이_꺼져_있으면_정기_보충은_아무것도_하지_않는다() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);

        new SampleObservationReseeder(jdbcTemplate, true, false).scheduledTopUp();

        verifyNoInteractions(jdbcTemplate);
    }
}
