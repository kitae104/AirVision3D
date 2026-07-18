package com.airvision.backend.publicdata.kma;

import com.airvision.backend.common.KstTimes;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * 기상청 단기예보 2.0 발표 주기에 맞는 최신 base_date/base_time 계산 (KST 기준).
 * 초단기실황: 매시 40분 발표 → 45분 이후에 해당 정시 자료 사용.
 * 초단기예보: 매시 45분 발표(base_time=HH30) → 50분 이후에 해당 시각 자료 사용.
 */
public final class KmaBaseTime {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyyMMdd");

    private KmaBaseTime() {
    }

    public record BaseDateTime(String baseDate, String baseTime) {
    }

    /** 초단기실황(getUltraSrtNcst)용 최신 발표 시각. */
    public static BaseDateTime forUltraNcst(Clock clock) {
        LocalDateTime kst = KstTimes.nowKst(clock);
        if (kst.getMinute() < 45) {
            kst = kst.minusHours(1);
        }
        return new BaseDateTime(kst.format(DATE), "%02d00".formatted(kst.getHour()));
    }

    /** 초단기예보(getUltraSrtFcst)용 최신 발표 시각. */
    public static BaseDateTime forUltraFcst(Clock clock) {
        LocalDateTime kst = KstTimes.nowKst(clock);
        if (kst.getMinute() < 50) {
            kst = kst.minusHours(1);
        }
        return new BaseDateTime(kst.format(DATE), "%02d30".formatted(kst.getHour()));
    }
}
