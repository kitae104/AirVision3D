package com.airvision.backend.publicdata.airkorea;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.airvision.backend.publicdata.ExternalApiUnavailableException;
import com.airvision.backend.publicdata.PublicDataNotConfiguredException;
import com.airvision.backend.publicdata.airkorea.dto.CurrentAirQualityResponse;
import com.airvision.backend.publicdata.airkorea.dto.PollutantValue;
import com.airvision.backend.publicdata.airkorea.dto.StationAirQuality;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc(addFilters = false)
@WebMvcTest(AirQualityCurrentController.class)
class AirQualityCurrentControllerTest {

    @Autowired
    MockMvc mockMvc;

    @MockitoBean
    AirKoreaService airKoreaService;

    private static CurrentAirQualityResponse sample(boolean stale) {
        PollutantValue pm25 = new PollutantValue(12.0, "µg/m³", "좋음", true, "NORMAL");
        StationAirQuality station = new StationAirQuality("송도", "인천",
                37.38256, 126.65463, true, Instant.parse("2026-07-18T05:00:00Z"),
                pm25, pm25, pm25, pm25, pm25, pm25, pm25);
        return new CurrentAirQualityResponse("인천", "AIRKOREA", true, stale,
                Instant.parse("2026-07-18T05:10:00Z"),
                stale ? "외부 API 연결 문제로 마지막 정상 데이터를 표시합니다." : null,
                List.of(station));
    }

    @Test
    void 실시간_대기질을_공통_응답_형식으로_반환한다() throws Exception {
        when(airKoreaService.current(any())).thenReturn(sample(false));

        mockMvc.perform(get("/api/air-quality/current").param("sido", "인천"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.sido").value("인천"))
                .andExpect(jsonPath("$.data.source").value("AIRKOREA"))
                .andExpect(jsonPath("$.data.stations[0].stationName").value("송도"))
                .andExpect(jsonPath("$.data.stations[0].pm25.value").value(12.0))
                .andExpect(jsonPath("$.data.stations[0].pm25.grade").value("좋음"));
    }

    @Test
    void stale_데이터에는_안내_메시지가_포함된다() throws Exception {
        when(airKoreaService.current(any())).thenReturn(sample(true));

        mockMvc.perform(get("/api/air-quality/current"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.stale").value(true))
                .andExpect(jsonPath("$.data.message").isNotEmpty());
    }

    @Test
    void 외부_API_연결_실패는_502를_반환한다() throws Exception {
        when(airKoreaService.current(any())).thenThrow(
                new ExternalApiUnavailableException("AirKorea API에 연결할 수 없습니다",
                        new RuntimeException()));

        mockMvc.perform(get("/api/air-quality/current"))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void 키_미설정은_503과_명확한_메시지를_반환한다() throws Exception {
        when(airKoreaService.current(any())).thenThrow(
                new PublicDataNotConfiguredException("AirKorea 서비스키가 설정되지 않았습니다"));

        mockMvc.perform(get("/api/air-quality/current"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.message").isNotEmpty());
    }

    @Test
    void 잘못된_시도명은_400이다() throws Exception {
        when(airKoreaService.current(any())).thenThrow(
                new IllegalArgumentException("지원하지 않는 시도명입니다"));

        mockMvc.perform(get("/api/air-quality/current").param("sido", "없는시도"))
                .andExpect(status().isBadRequest());
    }
}
