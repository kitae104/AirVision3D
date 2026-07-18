package com.airvision.backend.publicdata.collector;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.airvision.backend.publicdata.collector.dto.CollectionResult;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc(addFilters = false)
@WebMvcTest(PublicDataCollectController.class)
class PublicDataCollectControllerTest {

    @Autowired
    MockMvc mockMvc;

    @MockitoBean
    PublicDataCollector collector;

    @Test
    void 수동_수집을_트리거하고_결과_요약을_반환한다() throws Exception {
        when(collector.collectOnce()).thenReturn(
                new CollectionResult(43, 3, 2, false, Instant.parse("2026-07-18T05:10:00Z")));

        mockMvc.perform(post("/api/public-data/collect"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.measurementsUpserted").value(43))
                .andExpect(jsonPath("$.data.mock").value(false));
    }
}
