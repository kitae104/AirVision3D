package com.airvision.backend.publicdata.wind;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.airvision.backend.publicdata.PublicDataProperties;
import com.airvision.backend.publicdata.kma.KmaRaw;
import com.airvision.backend.publicdata.kma.KmaWeatherClient;
import com.airvision.backend.publicdata.wind.dto.WindFieldResponse;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class WindFieldServiceTest {

    private KmaWeatherClient client;
    private WindFieldService service;

    private static KmaRaw.Item fcstItem(String category, String fcstTime, String value) {
        return new KmaRaw.Item("20260718", "1330", category, 55, 124, null,
                "20260718", fcstTime, value);
    }

    @BeforeEach
    void setUp() {
        client = mock(KmaWeatherClient.class);
        when(client.isMock()).thenReturn(true);
        PublicDataProperties props = new PublicDataProperties("auto",
                new PublicDataProperties.Cache(1800, 86400, 3600, 1800, 1800),
                new PublicDataProperties.Comparison(5, 60));
        service = new WindFieldService(client, props,
                Clock.fixed(Instant.parse("2026-07-18T05:55:00Z"), ZoneId.of("UTC")));
    }

    @Test
    void UUU_VVV_성분으로_시간별_바람장을_만든다() {
        when(client.ultraFcst(any(), anyInt(), anyInt())).thenReturn(List.of(
                fcstItem("UUU", "1500", "3.0"), fcstItem("VVV", "1500", "-1.0"),
                fcstItem("UUU", "1600", "2.0"), fcstItem("VVV", "1600", "0.5")));

        WindFieldResponse field = service.field();

        assertThat(field.width()).isEqualTo(40);
        assertThat(field.height()).isEqualTo(20);
        assertThat(field.hours()).hasSize(2);
        WindFieldResponse.HourField h0 = field.hours().get(0);
        assertThat(h0.u()).hasSize(40 * 20);
        // 전 격자점 동일 응답 → 균일 바람장: 모든 셀 u=3.0, v=-1.0
        assertThat(h0.u().get(0)).isCloseTo(3.0, org.assertj.core.data.Offset.offset(1e-6));
        assertThat(h0.v().get(312)).isCloseTo(-1.0, org.assertj.core.data.Offset.offset(1e-6));
        double speed = Math.sqrt(3.0 * 3.0 + 1.0 * 1.0);
        assertThat(h0.speedMax()).isCloseTo(speed, org.assertj.core.data.Offset.offset(1e-6));
        assertThat(field.bounds().west()).isEqualTo(WindGridPoints.WEST);
    }

    @Test
    void UUU_VVV가_없으면_VEC_WSD에서_변환한다() {
        // 서풍 2.0 m/s → u=+2.0, v=0
        when(client.ultraFcst(any(), anyInt(), anyInt())).thenReturn(List.of(
                fcstItem("WSD", "1500", "2.0"), fcstItem("VEC", "1500", "270")));

        WindFieldResponse field = service.field();

        assertThat(field.hours()).hasSize(1);
        assertThat(field.hours().get(0).u().get(100))
                .isCloseTo(2.0, org.assertj.core.data.Offset.offset(1e-6));
        assertThat(field.hours().get(0).v().get(100))
                .isCloseTo(0.0, org.assertj.core.data.Offset.offset(1e-6));
    }

    @Test
    void 바람_카테고리가_전혀_없으면_hours가_비어있다() {
        when(client.ultraFcst(any(), anyInt(), anyInt())).thenReturn(List.of(
                fcstItem("T1H", "1500", "27.0")));

        assertThat(service.field().hours()).isEmpty();
    }
}
