package com.airvision.backend.publicdata.wind;

import java.util.List;

/**
 * 바람장 수집 대상 수도권(서울·인천·경기) 영역과 KMA 격자 샘플 지점.
 * 인천 핵심 3구의 미세먼지가 어디서 유입되고 어디로 흘러가는지 보이도록
 * 상류·하류에 해당하는 수도권 전역을 도메인으로 잡는다 (2026-07-25 인천권에서 확장).
 */
public final class WindGridPoints {

    public static final double WEST = 126.30;
    public static final double SOUTH = 36.90;
    public static final double EAST = 127.85;
    public static final double NORTH = 38.10;

    public record Point(double latitude, double longitude) {
    }

    /**
     * 수도권 내륙 위주 18개 샘플 지점 (남→북 4열 + 서북·동북 보강).
     * 바다 격자는 초단기예보 응답이 비는 경우가 있어 도시·내륙 지점을 고른다.
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
            // 서·북 경계 보강 (영종·강화·연천)
            new Point(37.49, 126.53), new Point(37.75, 126.49), new Point(38.03, 127.07));

    private WindGridPoints() {
    }
}
