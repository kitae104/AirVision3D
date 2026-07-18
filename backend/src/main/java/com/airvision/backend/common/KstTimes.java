package com.airvision.backend.common;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;

/**
 * 공공 API의 KST 시각 문자열을 내부 표준(UTC Instant)으로 변환한다.
 * AirKorea·기상청 응답 시각은 타임존 표기가 없는 한국 로컬 시각이다.
 */
public final class KstTimes {

    public static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private static final DateTimeFormatter DATA_TIME =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    private static final DateTimeFormatter COMPACT_DATE = DateTimeFormatter.BASIC_ISO_DATE;

    private KstTimes() {
    }

    /**
     * AirKorea dataTime("yyyy-MM-dd HH:mm")을 Instant로 변환한다.
     * AirKorea는 자정을 "24:00"으로 표기하므로 다음 날 00:00으로 처리한다.
     * 형식이 다르거나 비어 있으면 null을 반환한다(값 없음).
     */
    public static Instant parseDataTime(String dataTime) {
        if (dataTime == null || dataTime.isBlank()) {
            return null;
        }
        String text = dataTime.trim();
        boolean midnight = text.endsWith(" 24:00");
        if (midnight) {
            text = text.replace(" 24:00", " 00:00");
        }
        try {
            LocalDateTime local = LocalDateTime.parse(text, DATA_TIME);
            if (midnight) {
                local = local.plusDays(1);
            }
            return local.atZone(KST).toInstant();
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    /**
     * 기상청 base/fcst 일자("yyyyMMdd")와 시각("HHmm")을 Instant로 변환한다.
     * 형식 오류 시 null.
     */
    public static Instant parseKmaDateTime(String date, String time) {
        if (date == null || time == null || date.isBlank() || time.isBlank()) {
            return null;
        }
        try {
            LocalDate day = LocalDate.parse(date.trim(), COMPACT_DATE);
            String hhmm = time.trim();
            int hour = Integer.parseInt(hhmm.substring(0, 2));
            int minute = hhmm.length() >= 4 ? Integer.parseInt(hhmm.substring(2, 4)) : 0;
            return day.atTime(hour, minute).atZone(KST).toInstant();
        } catch (RuntimeException e) {
            return null;
        }
    }

    /** 현재(또는 지정 시각)의 KST LocalDateTime. */
    public static LocalDateTime nowKst(java.time.Clock clock) {
        return LocalDateTime.ofInstant(clock.instant(), KST);
    }
}
