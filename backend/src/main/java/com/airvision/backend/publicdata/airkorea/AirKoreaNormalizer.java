package com.airvision.backend.publicdata.airkorea;

import java.util.ArrayList;
import java.util.List;

/**
 * AirKorea 원본 문자열 값을 검증·정규화한다.
 * "-", 빈 문자열, null, 통신장애 플래그를 숫자로 강제 변환하지 않고
 * 값 없음/점검/장애 상태를 구분한다. 0과 "값 없음"은 다르다.
 */
public final class AirKoreaNormalizer {

    /** 측정값 상태. */
    public static final String STATUS_NORMAL = "NORMAL";
    public static final String STATUS_NO_DATA = "NO_DATA";
    public static final String STATUS_COMM_ERROR = "COMM_ERROR";
    public static final String STATUS_MAINTENANCE = "MAINTENANCE";
    public static final String STATUS_INVALID = "INVALID";

    private AirKoreaNormalizer() {
    }

    /** 정규화된 측정값. valid=false면 value는 null이다. */
    public record Measured(Double value, boolean valid, String status) {

        public static final Measured NO_DATA = new Measured(null, false, STATUS_NO_DATA);
    }

    /**
     * 원본 값 문자열 + 데이터 플래그 → 정규화 측정값.
     * 플래그: 통신장애 / 장비점검 / 점검및교정 / 자료이상 (에어코리아 기술문서)
     */
    public static Measured measured(String rawValue, String flag) {
        if (flag != null && !flag.isBlank()) {
            String f = flag.trim();
            if (f.contains("통신")) {
                return new Measured(null, false, STATUS_COMM_ERROR);
            }
            if (f.contains("점검")) {
                return new Measured(null, false, STATUS_MAINTENANCE);
            }
            return new Measured(null, false, STATUS_INVALID);
        }
        if (rawValue == null || rawValue.isBlank() || "-".equals(rawValue.trim())
                || "null".equalsIgnoreCase(rawValue.trim())) {
            return Measured.NO_DATA;
        }
        try {
            return new Measured(Double.parseDouble(rawValue.trim()), true, STATUS_NORMAL);
        } catch (NumberFormatException e) {
            return new Measured(null, false, STATUS_INVALID);
        }
    }

    /** 등급 코드(1~4) → 한글 등급명. 그 외는 null (등급 없음). */
    public static String gradeLabel(String gradeCode) {
        if (gradeCode == null) {
            return null;
        }
        return switch (gradeCode.trim()) {
            case "1" -> "좋음";
            case "2" -> "보통";
            case "3" -> "나쁨";
            case "4" -> "매우나쁨";
            default -> null;
        };
    }

    /** 좌표 문자열 → Double. 비어 있거나 형식 오류면 null (임의 좌표 생성 금지). */
    public static Double parseCoord(String raw) {
        if (raw == null || raw.isBlank() || "-".equals(raw.trim())) {
            return null;
        }
        try {
            return Double.parseDouble(raw.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** 권역별 예보등급. */
    public record RegionGrade(String region, String grade) {
    }

    /**
     * informGrade("서울 : 나쁨,제주 : 보통,...") → 권역/등급 목록.
     * 형식이 다른 항목은 건너뛴다.
     */
    public static List<RegionGrade> parseInformGrade(String informGrade) {
        List<RegionGrade> result = new ArrayList<>();
        if (informGrade == null || informGrade.isBlank()) {
            return result;
        }
        for (String part : informGrade.split(",")) {
            String[] pair = part.split(":");
            if (pair.length == 2) {
                String region = pair[0].trim();
                String grade = pair[1].trim();
                if (!region.isEmpty() && !grade.isEmpty()) {
                    result.add(new RegionGrade(region, grade));
                }
            }
        }
        return result;
    }

    /**
     * 예보 발표시각 파싱. "2026-07-18 11시 발표", "2026-07-18 11:00" 형식 모두 지원.
     * 해석 불가 시 null.
     */
    public static java.time.Instant parseAnnouncedTime(String dataTime) {
        if (dataTime == null || dataTime.isBlank()) {
            return null;
        }
        java.util.regex.Matcher m = java.util.regex.Pattern
                .compile("(\\d{4}-\\d{2}-\\d{2})\\D+(\\d{1,2})")
                .matcher(dataTime);
        if (!m.find()) {
            return null;
        }
        try {
            int hour = Integer.parseInt(m.group(2));
            if (hour > 23) {
                return null;
            }
            return java.time.LocalDate.parse(m.group(1)).atTime(hour, 0)
                    .atZone(com.airvision.backend.common.KstTimes.KST).toInstant();
        } catch (RuntimeException e) {
            return null;
        }
    }

    /** 주소 문자열에서 시도명(첫 토큰) 추출. */
    public static String sidoOfAddr(String addr) {
        if (addr == null || addr.isBlank()) {
            return null;
        }
        String first = addr.trim().split("\\s+")[0];
        return first.isEmpty() ? null : first;
    }
}
