package com.airvision.backend.publicdata.cctv;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.airvision.backend.publicdata.ItsCctvProperties;
import com.airvision.backend.publicdata.cctv.dto.CctvStreamsResponse;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class CctvStreamServiceTest {

    private CctvClient client;
    private CctvStreamService service;

    @BeforeEach
    void setUp() {
        client = mock(CctvClient.class);
        when(client.isMock()).thenReturn(false);
        service = new CctvStreamService(client,
                new ItsCctvProperties("key", "https://example", 300),
                Clock.fixed(Instant.parse("2026-07-25T05:00:00Z"), ZoneId.of("UTC")));
    }

    private static CctvRaw.Item item(String name, String lon, String lat, String url) {
        return new CctvRaw.Item(name, url, "HLS", "1", lon, lat);
    }

    @Test
    void 핵심_3구_안의_카메라만_구_이름과_함께_반환한다() {
        when(client.cctvs(anyDouble(), anyDouble(), anyDouble(), anyDouble()))
                .thenReturn(List.of(
                        item("송도국제대로", "126.6400", "37.3900", "http://cctv/1.m3u8"),
                        item("주안역", "126.6800", "37.4650", "http://cctv/2.m3u8"),
                        // 3구 bbox 밖 (부평 방향)
                        item("부평대로", "126.7200", "37.5100", "http://cctv/3.m3u8")));

        CctvStreamsResponse response = service.streams();

        assertThat(response.count()).isEqualTo(2);
        assertThat(response.cameras())
                .extracting(CctvStreamsResponse.Camera::district)
                .containsExactly("미추홀구", "연수구"); // 구·이름 정렬
        assertThat(response.cameras().get(1).streamUrl()).isEqualTo("http://cctv/1.m3u8");
        assertThat(response.mock()).isFalse();
    }

    @Test
    void 좌표가_없거나_숫자가_아닌_항목은_제외한다() {
        when(client.cctvs(anyDouble(), anyDouble(), anyDouble(), anyDouble()))
                .thenReturn(List.of(
                        item("좌표 없음", null, null, "http://cctv/1.m3u8"),
                        item("좌표 오류", "abc", "37.39", "http://cctv/2.m3u8"),
                        item("정상", "126.6400", "37.3900", "http://cctv/3.m3u8")));

        CctvStreamsResponse response = service.streams();

        assertThat(response.count()).isEqualTo(1);
        assertThat(response.cameras().get(0).name()).isEqualTo("정상");
    }

    @Test
    void Mock_모드에서는_mock_플래그가_전달된다() {
        when(client.isMock()).thenReturn(true);
        when(client.cctvs(anyDouble(), anyDouble(), anyDouble(), anyDouble()))
                .thenReturn(List.of(item("Mock 카메라", "126.6400", "37.3900", "")));

        CctvStreamsResponse response = service.streams();

        assertThat(response.mock()).isTrue();
        assertThat(response.cameras().get(0).streamUrl()).isEmpty();
    }
}
