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
 *
 * <p>좌표는 컬럼 라벨을 신뢰하지 않고 <b>값의 범위</b>로 위도/경도를 판별한다 — 실데이터(2026-07 확인)는
 * "367.98(37°29'49.2\")"처럼 내부 도면좌표 뒤 괄호에 도분초가 들어 있고, X축 컬럼에 위도(37°)·
 * Y축 컬럼에 경도(126°)가 뒤바뀌어 기록된 경우가 있기 때문. 도분초·십진수 표기를 모두 허용하고
 * 한국 근방 범위(위도 33~39.5, 경도 124~132)를 벗어나는 값은 버린다.</p>
 */
public final class OdorNormalizer {

    private static final Pattern NUMBER = Pattern.compile("-?\\d+(?:\\.\\d+)?");
    /** 도분초 표기: 37°29'49.2" (기호 전후 공백·초 기호 생략 허용) */
    private static final Pattern DMS =
            Pattern.compile("(\\d{1,3})\\s*°\\s*(\\d{1,2})\\s*['′]\\s*(\\d+(?:\\.\\d+)?)");

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
            Double[] coords = coords(row);
            Double dilution = number(pick(row, "측정값", "희석배수", "복합악취"));
            if (spot == null && address == null && dilution == null) {
                continue; // 완전 빈 행
            }
            result.add(new OdorMeasurement(office, spot, address, coords[0], coords[1], date, dilution));
        }
        return result;
    }

    /** 좌표 후보 컬럼(위도/경도/좌표 포함)의 값을 모두 해석해 범위로 [위도, 경도]를 판별한다. */
    private static Double[] coords(Map<String, Object> row) {
        Double lat = null;
        Double lon = null;
        for (Map.Entry<String, Object> entry : row.entrySet()) {
            String key = entry.getKey();
            if (key == null
                    || !(key.contains("위도") || key.contains("경도") || key.contains("좌표"))) {
                continue;
            }
            Double value = geoValue(entry.getValue());
            if (value == null) {
                continue;
            }
            if (lat == null && value >= 33.0 && value <= 39.5) {
                lat = value;
            } else if (lon == null && value >= 124.0 && value <= 132.0) {
                lon = value;
            }
        }
        return new Double[] {lat, lon};
    }

    /** 좌표 값 해석: 도분초 표기가 있으면 십진도로 변환, 없으면 십진수 그대로. */
    static Double geoValue(Object value) {
        if (value == null) {
            return null;
        }
        Matcher dms = DMS.matcher(value.toString());
        if (dms.find()) {
            return Double.parseDouble(dms.group(1))
                    + Double.parseDouble(dms.group(2)) / 60.0
                    + Double.parseDouble(dms.group(3)) / 3600.0;
        }
        return number(value);
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

}
