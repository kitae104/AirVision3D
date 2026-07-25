package com.airvision.backend.publicdata.wind;

import java.util.List;

/**
 * 바람장 수집 대상 중부권(서해~동해) 영역과 KMA 격자 샘플 지점.
 * 인천 핵심 3구의 미세먼지가 서해에서 유입돼 내륙을 지나 동해로 빠져나가는
 * 흐름 전체가 보이도록 서해 앞바다~동해 앞바다를 가로로 넓게 잡는다
 * (2026-07-25 수도권에서 확장).
 */
public final class WindGridPoints {

    public static final double WEST = 125.70;
    public static final double SOUTH = 36.90;
    public static final double EAST = 129.50;
    public static final double NORTH = 38.10;

    public record Point(double latitude, double longitude) {
    }

    /**
     * 중부권 내륙·도서 위주 29개 샘플 지점 (수도권 18 + 강원·충북 11 확장).
     * 바다 격자는 초단기예보 응답이 비는 경우가 있어 도시·내륙·유인도 지점을 고른다.
     * 서해·동해 앞바다 셀은 인접 해안 지점 값으로 IDW 외삽된다.
     * 각 지점은 KMA 5km 격자로 변환해 예보를 조회한다 (같은 격자는 1회만 호출).
     */
    public static final List<Point> POINTS = List.of(
            // 남부 (화성·평택·안성·이천 남부)
            new Point(37.00, 126.83), new Point(36.99, 127.11), new Point(37.01, 127.44),
            // 중남부 (시흥·수원·용인·이천)
            new Point(37.32, 126.80), new Point(37.26, 127.03), new Point(37.24, 127.18),
            new Point(37.28, 127.44),
            // 중부 (인천·서울·하남·양평)
            new Point(37.46, 126.70), new Point(37.57, 126.98), new Point(37.54, 127.21),
            new Point(37.49, 127.49),
            // 북부 (파주·의정부·포천·가평)
            new Point(37.76, 126.78), new Point(37.74, 127.03), new Point(37.89, 127.20),
            new Point(37.83, 127.51),
            // 서해 도서·서북 경계 (덕적·영종·강화·연천)
            new Point(37.23, 126.15), new Point(37.49, 126.53), new Point(37.75, 126.49),
            new Point(38.03, 127.07),
            // 강원 영서 (춘천·홍천·원주·인제)
            new Point(37.88, 127.73), new Point(37.69, 127.89), new Point(37.34, 127.92),
            new Point(38.06, 128.17),
            // 충북 북부 (충주·제천)
            new Point(36.97, 127.93), new Point(37.14, 128.21),
            // 강원 산지·영동 해안 (평창·속초·강릉·동해)
            new Point(37.37, 128.40), new Point(38.00, 128.59), new Point(37.75, 128.90),
            new Point(37.52, 129.11));

    private WindGridPoints() {
    }
}
