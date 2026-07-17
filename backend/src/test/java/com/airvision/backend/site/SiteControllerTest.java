package com.airvision.backend.site;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.airvision.backend.common.NotFoundException;
import com.airvision.backend.site.dto.SiteResponse;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/** 관측소 CRUD API의 응답 형식과 상태코드를 검증한다 (DB 불필요, 서비스는 mock). */
@AutoConfigureMockMvc(addFilters = false)
@WebMvcTest(SiteController.class)
class SiteControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private SiteService siteService;

    private SiteResponse sampleSite(Long id) {
        return new SiteResponse(id, "서울시청", 37.5665, 126.9780, 38.0,
                "SENSOR", "테스트 관측소", "POINT(126.978 37.5665)",
                Instant.parse("2026-07-17T00:00:00Z"), Instant.parse("2026-07-17T00:00:00Z"));
    }

    @Test
    void list_returnsSites() throws Exception {
        when(siteService.findAll()).thenReturn(List.of(sampleSite(1L)));

        mockMvc.perform(get("/api/sites"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].name").value("서울시청"))
                .andExpect(jsonPath("$.data[0].latitude").value(37.5665));
    }

    @Test
    void get_returnsSiteWithGeomWkt() throws Exception {
        when(siteService.findById(1L)).thenReturn(sampleSite(1L));

        mockMvc.perform(get("/api/sites/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.geomWkt").value("POINT(126.978 37.5665)"));
    }

    @Test
    void get_unknownId_returns404WithErrorMessage() throws Exception {
        when(siteService.findById(99L)).thenThrow(new NotFoundException("관측소", 99L));

        mockMvc.perform(get("/api/sites/99"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").isNotEmpty());
    }

    @Test
    void create_returns201() throws Exception {
        when(siteService.create(any())).thenReturn(sampleSite(1L));

        mockMvc.perform(post("/api/sites")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"서울시청","latitude":37.5665,"longitude":126.9780,
                                 "altitude":38.0,"siteType":"SENSOR","description":"테스트 관측소"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(1));
    }

    @Test
    void create_invalidLatitude_returns400() throws Exception {
        mockMvc.perform(post("/api/sites")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"잘못된 관측소","latitude":123.0,"longitude":126.9780}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").isNotEmpty());
    }

    @Test
    void create_missingName_returns400() throws Exception {
        mockMvc.perform(post("/api/sites")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"latitude":37.5,"longitude":127.0}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    void update_returnsUpdatedSite() throws Exception {
        when(siteService.update(eq(1L), any())).thenReturn(sampleSite(1L));

        mockMvc.perform(put("/api/sites/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"서울시청","latitude":37.5665,"longitude":126.9780}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("서울시청"));
    }

    @Test
    void delete_returnsOk() throws Exception {
        mockMvc.perform(delete("/api/sites/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    void delete_unknownId_returns404() throws Exception {
        doThrow(new NotFoundException("관측소", 99L)).when(siteService).delete(99L);

        mockMvc.perform(delete("/api/sites/99"))
                .andExpect(status().isNotFound());
    }
}
