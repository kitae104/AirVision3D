package com.airvision.backend.publicdata.kma;

/**
 * 위경도(WGS84) ↔ 기상청 단기예보 격자(nx, ny) 변환.
 * 기상청 단기예보 조회서비스 공식 기술문서의 Lambert Conformal Conic(DFS) 변환식을 구현.
 * UI가 아닌 이 유틸에서만 변환을 수행한다.
 */
public final class KmaGridConverter {

    private static final double RE = 6371.00877;   // 지구 반경 (km)
    private static final double GRID = 5.0;        // 격자 간격 (km)
    private static final double SLAT1 = 30.0;      // 표준위도 1
    private static final double SLAT2 = 60.0;      // 표준위도 2
    private static final double OLON = 126.0;      // 기준점 경도
    private static final double OLAT = 38.0;       // 기준점 위도
    private static final double XO = 43;           // 기준점 X좌표 (격자)
    private static final double YO = 136;          // 기준점 Y좌표 (격자)

    /** 격자 유효 범위 (기상청 기술문서: 1~149, 1~253) */
    private static final int NX_MAX = 149;
    private static final int NY_MAX = 253;

    private KmaGridConverter() {
    }

    public record GridXY(int nx, int ny) {
    }

    /** 위경도 → 격자. 격자 범위를 벗어나는 좌표(한반도 밖)는 예외. */
    public static GridXY toGrid(double latitude, double longitude) {
        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            throw new IllegalArgumentException("위도/경도 범위가 올바르지 않습니다");
        }
        double degrad = Math.PI / 180.0;
        double re = RE / GRID;
        double slat1 = SLAT1 * degrad;
        double slat2 = SLAT2 * degrad;
        double olon = OLON * degrad;
        double olat = OLAT * degrad;

        double sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5)
                / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
        sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
        double sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
        sf = Math.pow(sf, sn) * Math.cos(slat1) / sn;
        double ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
        ro = re * sf / Math.pow(ro, sn);

        double ra = Math.tan(Math.PI * 0.25 + latitude * degrad * 0.5);
        ra = re * sf / Math.pow(ra, sn);
        double theta = longitude * degrad - olon;
        if (theta > Math.PI) {
            theta -= 2.0 * Math.PI;
        }
        if (theta < -Math.PI) {
            theta += 2.0 * Math.PI;
        }
        theta *= sn;

        int nx = (int) Math.floor(ra * Math.sin(theta) + XO + 0.5);
        int ny = (int) Math.floor(ro - ra * Math.cos(theta) + YO + 0.5);

        if (nx < 1 || nx > NX_MAX || ny < 1 || ny > NY_MAX) {
            throw new IllegalArgumentException(
                    "기상청 격자 범위를 벗어난 좌표입니다 (한반도 인근만 지원): lat=%s, lon=%s"
                            .formatted(latitude, longitude));
        }
        return new GridXY(nx, ny);
    }
}
