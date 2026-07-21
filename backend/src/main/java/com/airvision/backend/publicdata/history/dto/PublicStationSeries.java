package com.airvision.backend.publicdata.history.dto;

import java.time.Instant;
import java.util.List;

/**
 * 시도 내 공공 측정소 1곳의 누적 PM2.5 시계열 (3D 지도 시계열 재생용).
 * 좌표가 있고 pm25 값이 존재하는 측정만 담는다.
 */
public record PublicStationSeries(String stationName, double latitude, double longitude,
                                  List<Sample> samples) {

    /** 특정 시각의 실측 PM2.5와 등급. */
    public record Sample(Instant measuredAt, double pm25, String pm25Grade) {
    }
}
