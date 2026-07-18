package com.airvision.backend.publicdata;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * Mock 모드용 fixture(실제 공공 API 원본 구조의 샘플 JSON) 로더.
 * 시연이 자연스럽도록 날짜/시각 플레이스홀더(__TODAY__ 등)를 현재 시각으로 치환한다.
 */
public final class FixtureLoader {

    private FixtureLoader() {
    }

    /** classpath fixtures/ 하위 파일을 읽어 플레이스홀더를 치환해 반환한다. */
    public static String load(String path, Map<String, String> replacements) {
        String resource = "/fixtures/" + path;
        try (InputStream in = FixtureLoader.class.getResourceAsStream(resource)) {
            if (in == null) {
                throw new IllegalStateException("fixture를 찾을 수 없습니다: " + resource);
            }
            String text = new String(in.readAllBytes(), StandardCharsets.UTF_8);
            for (Map.Entry<String, String> entry : replacements.entrySet()) {
                text = text.replace(entry.getKey(), entry.getValue());
            }
            return text;
        } catch (IOException e) {
            throw new IllegalStateException("fixture 읽기 실패: " + resource, e);
        }
    }
}
