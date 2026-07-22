package com.airvision.backend.dashboard;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/** 대시보드 API의 구 단위 필터 파라미터 전달·검증을 확인한다 (DB 불필요). */
@AutoConfigureMockMvc(addFilters = false)
@WebMvcTest(DashboardController.class)
class DashboardControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private DashboardService dashboardService;

    @Test
    void summary_구지정시_검증된_구를_서비스에_전달한다() throws Exception {
        when(dashboardService.summary("미추홀구"))
                .thenReturn(Map.<String, Object>of("siteCount", 2L, "district", "미추홀구"));

        mockMvc.perform(get("/api/dashboard/summary").param("district", "미추홀구"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.siteCount").value(2))
                .andExpect(jsonPath("$.data.district").value("미추홀구"));
    }

    @Test
    void summary_구미지정시_null을_전달한다() throws Exception {
        when(dashboardService.summary(null))
                .thenReturn(Map.<String, Object>of("siteCount", 13L));

        mockMvc.perform(get("/api/dashboard/summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.siteCount").value(13));
    }

    @Test
    void summary_허용되지_않은_구는_400() throws Exception {
        mockMvc.perform(get("/api/dashboard/summary").param("district", "강남구"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void hourly_구지정시_구를_서비스에_전달한다() throws Exception {
        when(dashboardService.hourlyAverage(24, "연수구")).thenReturn(List.of());

        mockMvc.perform(get("/api/dashboard/hourly")
                        .param("hours", "24").param("district", "연수구"))
                .andExpect(status().isOk());
    }
}
