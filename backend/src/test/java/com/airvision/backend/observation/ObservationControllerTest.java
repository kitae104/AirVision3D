package com.airvision.backend.observation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.airvision.backend.common.PageResponse;
import com.airvision.backend.observation.dto.ObservationResponse;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/** 관측값 CRUD API의 응답 형식과 유효성 검증을 확인한다 (DB 불필요, 서비스는 mock). */
@AutoConfigureMockMvc(addFilters = false)
@WebMvcTest(ObservationController.class)
class ObservationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ObservationService observationService;

    private ObservationResponse sampleObservation() {
        return new ObservationResponse(1L, 1L, "서울시청",
                Instant.parse("2026-07-17T09:00:00Z"),
                45.2, 25.3, 24.1, 60.5, 2.3, 180.0,
                Instant.parse("2026-07-17T09:05:00Z"));
    }

    @Test
    void search_returnsPagedObservations() throws Exception {
        when(observationService.search(eq(1L), isNull(), isNull(), eq(0), eq(20)))
                .thenReturn(new PageResponse<>(List.of(sampleObservation()), 0, 20, 1, 1));

        mockMvc.perform(get("/api/observations").param("siteId", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.content[0].pm25").value(25.3))
                .andExpect(jsonPath("$.data.totalElements").value(1));
    }

    @Test
    void create_returns201() throws Exception {
        when(observationService.create(any())).thenReturn(sampleObservation());

        mockMvc.perform(post("/api/observations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"siteId":1,"observedAt":"2026-07-17T09:00:00Z",
                                 "pm10":45.2,"pm25":25.3,"temperature":24.1,
                                 "humidity":60.5,"windSpeed":2.3,"windDirection":180.0}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.siteName").value("서울시청"));
    }

    @Test
    void create_missingSiteId_returns400() throws Exception {
        mockMvc.perform(post("/api/observations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"observedAt":"2026-07-17T09:00:00Z","pm25":25.3}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void create_invalidHumidity_returns400() throws Exception {
        mockMvc.perform(post("/api/observations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"siteId":1,"observedAt":"2026-07-17T09:00:00Z","humidity":150}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    void create_negativePm25_returns400() throws Exception {
        mockMvc.perform(post("/api/observations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"siteId":1,"observedAt":"2026-07-17T09:00:00Z","pm25":-5}
                                """))
                .andExpect(status().isBadRequest());
    }
}
