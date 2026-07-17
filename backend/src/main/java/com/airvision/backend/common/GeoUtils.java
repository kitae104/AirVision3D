package com.airvision.backend.common;

/** 지리 좌표 유틸리티. */
public final class GeoUtils {

    /** IUGG 평균 지구 반지름 (km). scripts/idw_reference.py와 동일한 값을 사용해야 한다. */
    public static final double EARTH_RADIUS_KM = 6371.0088;

    private GeoUtils() {
    }

    /** 두 위경도 좌표 간 Haversine 거리(km). */
    public static double haversineKm(double lat1, double lon1, double lat2, double lon2) {
        double phi1 = Math.toRadians(lat1);
        double phi2 = Math.toRadians(lat2);
        double dPhi = Math.toRadians(lat2 - lat1);
        double dLambda = Math.toRadians(lon2 - lon1);

        double a = Math.sin(dPhi / 2) * Math.sin(dPhi / 2)
                + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
        return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
    }
}
