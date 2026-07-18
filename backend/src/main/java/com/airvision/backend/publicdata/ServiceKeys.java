package com.airvision.backend.publicdata;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

/**
 * 공공데이터포털 인증키 정규화.
 * 표준은 "디코딩(원본)" 키이지만, 사용자가 "인코딩" 키를 넣은 경우
 * (% 포함) 1회 디코드해 이중 URL 인코딩을 방지한다.
 */
public final class ServiceKeys {

    private ServiceKeys() {
    }

    public static String normalize(String serviceKey) {
        if (serviceKey == null || serviceKey.isBlank()) {
            return "";
        }
        String key = serviceKey.trim();
        if (key.contains("%")) {
            try {
                return URLDecoder.decode(key, StandardCharsets.UTF_8);
            } catch (IllegalArgumentException e) {
                return key;
            }
        }
        return key;
    }

    /** 로그 출력용 마스킹 (전체 키 노출 금지). */
    public static String mask(String serviceKey) {
        if (serviceKey == null || serviceKey.length() < 8) {
            return "****";
        }
        return serviceKey.substring(0, 4) + "****";
    }
}
