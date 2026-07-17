package com.airvision.backend.interpolation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.airvision.backend.interpolation.dto.InterpolationResponse;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/** IDW 보간 실행 API의 요청 검증과 응답 형식을 확인한다 (DB 불필요, 서비스는 mock). */
@AutoConfigureMockMvc(addFilters = false)
@WebMvcTest(InterpolationController.class)
class InterpolationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private InterpolationService interpolationService;

    @Test
    void run_returns201WithResults() throws Exception {
        when(interpolationService.run(any())).thenReturn(List.of(
                new InterpolationResponse(1L, "목표지점", 37.54, 126.99, 25.2155,
                        "IDW", 2.0, "OBSERVATION", Instant.parse("2026-07-17T09:00:00Z"))));

        mockMvc.perform(post("/api/interpolations/run")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"power":2.0,"targets":[{"name":"목표지점","latitude":37.54,"longitude":126.99}]}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].pm25").value(25.2155))
                .andExpect(jsonPath("$.data[0].algorithm").value("IDW"));
    }

    @Test
    void run_emptyTargets_returns400() throws Exception {
        mockMvc.perform(post("/api/interpolations/run")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"power":2.0,"targets":[]}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void run_invalidPower_returns400() throws Exception {
        mockMvc.perform(post("/api/interpolations/run")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"power":-1,"targets":[{"latitude":37.5,"longitude":127.0}]}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    void run_missingLatitude_returns400() throws Exception {
        mockMvc.perform(post("/api/interpolations/run")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"targets":[{"name":"위도없음","longitude":127.0}]}
                                """))
                .andExpect(status().isBadRequest());
    }
}
