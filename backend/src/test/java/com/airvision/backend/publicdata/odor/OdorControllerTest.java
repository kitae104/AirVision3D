package com.airvision.backend.publicdata.odor;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.airvision.backend.publicdata.odor.dto.OdorResponse;
import com.airvision.backend.publicdata.odor.dto.OdorSpotResponse;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/** 악취 측정 현황 API 응답 형식을 확인한다 (서비스는 mock). */
@AutoConfigureMockMvc(addFilters = false)
@WebMvcTest(OdorController.class)
class OdorControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private OdorService odorService;

    @Test
    void measurements_returnsSpots() throws Exception {
        when(odorService.measurements()).thenReturn(new OdorResponse(
                true, false, Instant.parse("2026-07-22T00:00:00Z"), 1,
                List.of(new OdorSpotResponse("승기사업소", "정문", "인천 연수구 동춘동 926",
                        37.4021, 126.6832, true, "2026-06-17", 12.5, 12.5, 2)),
                List.of()));

        mockMvc.perform(get("/api/odor/measurements"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.mock").value(true))
                .andExpect(jsonPath("$.data.spotCount").value(1))
                .andExpect(jsonPath("$.data.spots[0].office").value("승기사업소"))
                .andExpect(jsonPath("$.data.spots[0].latestDilution").value(12.5));
    }
}
