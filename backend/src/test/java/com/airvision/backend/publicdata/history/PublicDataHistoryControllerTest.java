package com.airvision.backend.publicdata.history;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.airvision.backend.publicdata.history.dto.MeasurementHourlyPoint;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc(addFilters = false)
@WebMvcTest(PublicDataHistoryController.class)
class PublicDataHistoryControllerTest {

    @Autowired
    MockMvc mockMvc;

    @MockitoBean
    PublicDataHistoryService historyService;

    @Test
    void 시간별_평균을_공통_응답으로_반환한다() throws Exception {
        when(historyService.hourly(any(), any(), any())).thenReturn(List.of(
                new MeasurementHourlyPoint(Instant.parse("2026-07-18T04:00:00Z"),
                        40.0, 22.5, 8)));

        mockMvc.perform(get("/api/public-data/history/measurements/hourly"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].avgPm25").value(22.5))
                .andExpect(jsonPath("$.data[0].count").value(8));
    }

    @Test
    void 잘못된_기간은_400이다() throws Exception {
        when(historyService.hourly(any(), any(), any()))
                .thenThrow(new IllegalArgumentException("from은 to보다 앞서야 합니다"));

        mockMvc.perform(get("/api/public-data/history/measurements/hourly"))
                .andExpect(status().isBadRequest());
    }
}
