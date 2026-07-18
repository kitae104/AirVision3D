package com.airvision.backend.publicdata.airkorea.dto;

/**
 * AirKorea 측정소 (정규화 응답).
 * 좌표가 없는 측정소는 locationAvailable=false로 표시하고 지도에서는 제외한다.
 */
public record PublicStationResponse(
        String stationName,
        String addr,
        String sido,
        String mangName,
        String items,
        Double latitude,
        Double longitude,
        boolean locationAvailable,
        Double distanceKm
) {

    public PublicStationResponse withDistance(double km) {
        return new PublicStationResponse(stationName, addr, sido, mangName, items,
                latitude, longitude, locationAvailable, Math.round(km * 100) / 100.0);
    }
}
