package com.airvision.backend.publicdata.odor;

import com.airvision.backend.publicdata.odor.dto.OdorMeasurement;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * odcloud 원본 행(Map)을 정규화한다.
 * 데이터셋마다 컬럼명이 다르므로("좌표_위도_Y축", "위도", "좌표(Y)" 등) 키워드로 해석한다.
 * 좌표 범위(한국 근방)를 벗어나거나 희석배수가 없는 행은 dilution/좌표를 null로 남긴다.
 */
public final class OdorNormalizer {

    private static final Pattern NUMBER = Pattern.compile("-?\\d+(?:\\.\\d+)?");

    private OdorNormalizer() {
    }

    public static List<OdorMeasurement> normalize(String office, List<Map<String, Object>> rows) {
        List<OdorMeasurement> result = new ArrayList<>();
        if (rows == null) {
            return result;
        }
        for (Map<String, Object> row : rows) {
            String spot = text(pick(row, "측정지점", "측정장소", "장소", "지점"));
            String address = text(pick(row, "주소", "위치정보", "세부주소"));
            String date = text(pick(row, "측정일", "측정연월", "측정년월"));
            Double lat = coord(pick(row, "위도", "좌표(Y)", "Y축"), 33.0, 39.5);
            Double lon = coord(pick(row, "경도", "좌표(X)", "X축"), 124.0, 132.0);
            Double dilution = number(pick(row, "측정값", "희석배수", "복합악취"));
            if (spot == null && address == null && dilution == null) {
                continue; // 완전 빈 행
            }
            result.add(new OdorMeasurement(office, spot, address, lat, lon, date, dilution));
        }
        return result;
    }

    /** 컬럼명에 키워드가 포함된 첫 값을 반환 (키워드 우선순위 순서). */
    private static Object pick(Map<String, Object> row, String... keywords) {
        for (String keyword : keywords) {
            for (Map.Entry<String, Object> entry : row.entrySet()) {
                if (entry.getKey() != null && entry.getKey().contains(keyword)
                        && entry.getValue() != null && !entry.getValue().toString().isBlank()) {
                    return entry.getValue();
                }
            }
        }
        return null;
    }

    private static String text(Object value) {
        if (value == null) {
            return null;
        }
        String text = value.toString().trim();
        return text.isEmpty() || "-".equals(text) ? null : text;
    }

    /** 값에서 첫 숫자를 추출 ("15배", "1,234" 등 허용). 숫자가 없으면 null. */
    static Double number(Object value) {
        if (value instanceof Number n) {
            return n.doubleValue();
        }
        if (value == null) {
            return null;
        }
        Matcher m = NUMBER.matcher(value.toString().replace(",", ""));
        return m.find() ? Double.parseDouble(m.group()) : null;
    }

    private static Double coord(Object value, double min, double max) {
        Double parsed = number(value);
        return parsed != null && parsed >= min && parsed <= max ? parsed : null;
    }
}
