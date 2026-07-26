package com.airvision.backend.prediction;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.airvision.backend.ai.AiServiceUnavailableException;
import com.airvision.backend.common.PageResponse;
import com.airvision.backend.prediction.dto.PredictionResponse;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/** 예측 실행 API의 multipart 처리·오류 매핑을 검증한다 (DB·AI 서비스 불필요). */
@AutoConfigureMockMvc(addFilters = false)
@WebMvcTest(PredictionController.class)
class PredictionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private PredictionService predictionService;

    @MockitoBean
    private CctvEstimateService cctvEstimateService;

    @MockitoBean
    private PredictionAccuracyService predictionAccuracyService;

    private final MockMultipartFile image = new MockMultipartFile(
            "image", "sky.png", "image/png", new byte[]{1, 2, 3});

    private PredictionResponse sampleResponse() {
        return new PredictionResponse(1L, 1L, "서울시청", null, "resnet18_multimodal_v1",
                Instant.parse("2026-07-18T09:00:00Z"), 25.3, 28.75, "보통",
                Instant.parse("2026-07-18T09:00:01Z"));
    }

    @Test
    void run_returns201WithPrediction() throws Exception {
        when(predictionService.run(eq(1L), anyString(), any(), anyDouble(), anyDouble(), anyDouble()))
                .thenReturn(sampleResponse());

        mockMvc.perform(multipart("/api/predictions/run")
                        .file(image)
                        .param("siteId", "1")
                        .param("temperature", "24.5")
                        .param("humidity", "60")
                        .param("windSpeed", "2.0"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.predictedPm25").value(28.75))
                .andExpect(jsonPath("$.data.predictedGrade").value("보통"));
    }

    @Test
    void run_missingSiteId_returns400() throws Exception {
        mockMvc.perform(multipart("/api/predictions/run")
                        .file(image)
                        .param("temperature", "24.5")
                        .param("humidity", "60")
                        .param("windSpeed", "2.0"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void run_emptyImage_returns400() throws Exception {
        MockMultipartFile empty = new MockMultipartFile(
                "image", "empty.png", "image/png", new byte[0]);
        mockMvc.perform(multipart("/api/predictions/run")
                        .file(empty)
                        .param("siteId", "1")
                        .param("temperature", "24.5")
                        .param("humidity", "60")
                        .param("windSpeed", "2.0"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void run_aiServiceDown_returns502() throws Exception {
        when(predictionService.run(eq(1L), anyString(), any(), anyDouble(), anyDouble(), anyDouble()))
                .thenThrow(new AiServiceUnavailableException("AI 서비스에 연결할 수 없습니다", null));

        mockMvc.perform(multipart("/api/predictions/run")
                        .file(image)
                        .param("siteId", "1")
                        .param("temperature", "24.5")
                        .param("humidity", "60")
                        .param("windSpeed", "2.0"))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").isNotEmpty());
    }

    @Test
    void list_returnsPagedPredictions() throws Exception {
        when(predictionService.findRecent(eq(null), eq(null), eq(0), eq(20)))
                .thenReturn(new PageResponse<>(List.of(sampleResponse()), 0, 20, 1, 1));

        mockMvc.perform(get("/api/predictions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].siteName").value("서울시청"))
                .andExpect(jsonPath("$.data.totalElements").value(1));
    }

    @Test
    void list_withDistrict_passesDistrict() throws Exception {
        when(predictionService.findRecent(eq(null), eq("남동구"), eq(0), eq(20)))
                .thenReturn(new PageResponse<>(List.of(sampleResponse()), 0, 20, 1, 1));

        mockMvc.perform(get("/api/predictions").param("district", "남동구"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].predictedPm25").value(28.75));
    }

    @Test
    void list_invalidDistrict_returns400() throws Exception {
        mockMvc.perform(get("/api/predictions").param("district", "부평구"))
                .andExpect(status().isBadRequest());
    }
}
