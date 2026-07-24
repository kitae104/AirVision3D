package com.airvision.backend.publicdata.kma;

/**
 * 풍향 변환 유틸.
 * 기상청 VEC(풍향)는 기상학적 풍향 = 바람이 "불어오는" 방향(도, 북=0, 시계방향)이다.
 * 지도 화살표가 바람의 "이동 방향"을 나타내려면 180도 반전해야 한다.
 */
public final class WindUtils {

    private static final String[] DIRECTIONS_16 = {
            "북", "북북동", "북동", "동북동", "동", "동남동", "남동", "남남동",
            "남", "남남서", "남서", "서남서", "서", "서북서", "북서", "북북서"};

    private WindUtils() {
    }

    /** 풍향(도) → 16방위 한글 표기 (예: 315 → 북서풍). */
    public static String toText16(double degree) {
        double normalized = ((degree % 360) + 360) % 360;
        int index = (int) Math.floor((normalized + 11.25) / 22.5) % 16;
        return DIRECTIONS_16[index] + "풍";
    }

    /** 기상학적 풍향(불어오는 방향) → 지도 화살표 방향(이동 방향). */
    public static double arrowHeadingDeg(double meteorologicalDeg) {
        return (((meteorologicalDeg + 180) % 360) + 360) % 360;
    }

    /** 기상학적 풍향(불어오는 방향)·풍속 → 동서 성분 U (m/s, 동쪽 양수). */
    public static double toU(double speedMs, double meteorologicalDeg) {
        return -speedMs * Math.sin(Math.toRadians(meteorologicalDeg));
    }

    /** 기상학적 풍향(불어오는 방향)·풍속 → 남북 성분 V (m/s, 북쪽 양수). */
    public static double toV(double speedMs, double meteorologicalDeg) {
        return -speedMs * Math.cos(Math.toRadians(meteorologicalDeg));
    }
}
