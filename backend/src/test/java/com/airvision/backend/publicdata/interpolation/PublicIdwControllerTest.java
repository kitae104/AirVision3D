package com.airvision.backend.publicdata.interpolation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.airvision.backend.publicdata.interpolation.dto.IdwGridCell;
import com.airvision.backend.publicdata.interpolation.dto.IdwGridResponse;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc(addFilters = false)
@WebMvcTest(PublicIdwController.class)
class PublicIdwControllerTest {

    @Autowired
    MockMvc mockMvc;

    @MockitoBean
    PublicIdwService service;

    @Test
    void 격자_표면을_공통_응답으로_반환한다() throws Exception {
        IdwGridResponse res = new IdwGridResponse("인천", 2.0, 2, "AIRKOREA", true, false, 3,
                new IdwGridResponse.Bbox(37.3, 126.6, 37.7, 126.8),
                List.of(new IdwGridCell(37.4, 126.65, 22.5, "보통"),
                        new IdwGridCell(37.6, 126.75, 18.0, "보통")));
        when(service.grid(any(), any(), any())).thenReturn(res);

        mockMvc.perform(get("/api/air-quality/interpolation/grid").param("sido", "인천"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.source").value("AIRKOREA"))
                .andExpect(jsonPath("$.data.sourceCount").value(3))
                .andExpect(jsonPath("$.data.cells[0].pm25").value(22.5))
                .andExpect(jsonPath("$.data.cells[0].grade").value("보통"));
    }

    @Test
    void 유효_소스가_없으면_400이다() throws Exception {
        when(service.grid(any(), any(), any()))
                .thenThrow(new IllegalStateException("유효한 실측 측정소가 없어 보간할 수 없습니다"));

        mockMvc.perform(get("/api/air-quality/interpolation/grid"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }
}
