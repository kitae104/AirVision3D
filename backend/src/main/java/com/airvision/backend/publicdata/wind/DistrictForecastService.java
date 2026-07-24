package com.airvision.backend.publicdata.wind;

import com.airvision.backend.interpolation.IdwInterpolator;
import com.airvision.backend.publicdata.airkorea.AirKoreaService;
import com.airvision.backend.publicdata.airkorea.dto.CurrentAirQualityResponse;
import com.airvision.backend.publicdata.airkorea.dto.StationAirQuality;
import com.airvision.backend.publicdata.kma.WindUtils;
import com.airvision.backend.publicdata.wind.dto.AdvectionResponse;
import com.airvision.backend.publicdata.wind.dto.DistrictForecastResponse;
import com.airvision.backend.publicdata.wind.dto.WindFieldResponse;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * 인천 핵심 3구(미추홀·남동·연수) 확산 예측 요약.
 * 현재 추정치는 AirKorea 실측 IDW(구 중심), 시간별 예측은 이류 격자의 구 bbox 평균,
 * 바람 벡터는 바람장에서 구 중심 셀을 샘플링해 만든다.
 */
@Service
public class DistrictForecastService {

    static final double IDW_POWER = 2.0;
    /** 이 풍속(m/s) 미만이면 풍향 표기가 무의미한 무풍으로 본다. */
    static final double CALM_THRESHOLD_MS = 0.1;

    private final WindFieldService windFieldService;
    private final AdvectionService advectionService;
    private final AirKoreaService airKoreaService;

    public DistrictForecastService(WindFieldService windFieldService,
                                   AdvectionService advectionService,
                                   AirKoreaService airKoreaService) {
        this.windFieldService = windFieldService;
        this.advectionService = advectionService;
        this.airKoreaService = airKoreaService;
    }

    public DistrictForecastResponse forecast(int hours) {
        if (hours < 1 || hours > 6) {
            throw new IllegalArgumentException("hours는 1~6 범위여야 합니다");
        }
        WindFieldResponse wind = windFieldService.field();
        if (wind.hours().isEmpty()) {
            throw new IllegalStateException("바람 예보가 없어 구별 예측을 할 수 없습니다");
        }
        AdvectionResponse advection = advectionService.advect(hours);
        CurrentAirQualityResponse current = airKoreaService.current("인천");
        List<IdwInterpolator.SourcePoint> pm25Sources =
                AdvectionService.sources(current, StationAirQuality::pm25);
        List<IdwInterpolator.SourcePoint> pm10Sources =
                AdvectionService.sources(current, StationAirQuality::pm10);
        if (pm25Sources.isEmpty()) {
            throw new IllegalStateException("유효한 실측 측정소가 없어 구별 예측을 할 수 없습니다");
        }

        List<DistrictForecastResponse.DistrictNow> now = new ArrayList<>();
        for (Districts.District d : Districts.CORE_THREE) {
            Double pm25 = round1(IdwInterpolator.interpolate(
                    pm25Sources, d.centerLat(), d.centerLon(), IDW_POWER));
            Double pm10 = pm10Sources.isEmpty() ? null : round1(IdwInterpolator.interpolate(
                    pm10Sources, d.centerLat(), d.centerLon(), IDW_POWER));
            now.add(new DistrictForecastResponse.DistrictNow(
                    d.name(), pm25, pm10, windAt(wind, 0, d)));
        }

        List<DistrictForecastResponse.HourForecast> hourly = new ArrayList<>();
        for (int i = 0; i < advection.frames().size(); i++) {
            AdvectionResponse.Frame frame = advection.frames().get(i);
            List<DistrictForecastResponse.DistrictForecastValue> values = new ArrayList<>();
            for (Districts.District d : Districts.CORE_THREE) {
                Double pm25 = districtMean(frame.pm25(), advection, d);
                Double pm10 = frame.pm10() == null ? null : districtMean(frame.pm10(), advection, d);
                values.add(new DistrictForecastResponse.DistrictForecastValue(
                        d.name(), pm25, pm10, windAt(wind, i, d)));
            }
            hourly.add(new DistrictForecastResponse.HourForecast(frame.time(), values));
        }

        return new DistrictForecastResponse(wind.baseTime(), "KMA+AirKorea",
                advection.model(), wind.mock() || advection.mock() || current.mock(),
                now, hourly);
    }

    /** 바람장에서 구 중심에 가장 가까운 셀의 바람 벡터를 샘플링한다. */
    private static DistrictForecastResponse.WindVector windAt(
            WindFieldResponse wind, int hourIndex, Districts.District d) {
        WindFieldResponse.HourField hour =
                wind.hours().get(Math.min(hourIndex, wind.hours().size() - 1));
        WindFieldResponse.Bounds b = wind.bounds();
        int col = clampIndex(
                (d.centerLon() - b.west()) / (b.east() - b.west()) * wind.width(), wind.width());
        int row = clampIndex(
                (d.centerLat() - b.south()) / (b.north() - b.south()) * wind.height(),
                wind.height());
        int idx = row * wind.width() + col;
        double u = hour.u().get(idx);
        double v = hour.v().get(idx);
        double speed = Math.hypot(u, v);
        if (speed < CALM_THRESHOLD_MS) {
            return new DistrictForecastResponse.WindVector(round2(speed), null, "무풍", "정체");
        }
        // (u,v) 이동 벡터 → 기상학적 풍향(불어오는 방향, 북=0 시계방향)
        double directionDeg = (Math.toDegrees(Math.atan2(-u, -v)) + 360) % 360;
        String movement = WindUtils.toText16(WindUtils.arrowHeadingDeg(directionDeg))
                .replaceFirst("풍$", "") + "쪽으로 이동";
        return new DistrictForecastResponse.WindVector(
                round2(speed), round2(directionDeg), WindUtils.toText16(directionDeg), movement);
    }

    /** 구 bbox에 중심이 포함된 셀들의 평균. 포함 셀이 없으면 구 중심 최근접 셀 값. */
    private static Double districtMean(List<Double> values, AdvectionResponse advection,
                                       Districts.District d) {
        WindFieldResponse.Bounds b = advection.bounds();
        int w = advection.width();
        int h = advection.height();
        double sum = 0;
        int count = 0;
        for (int row = 0; row < h; row++) {
            double lat = b.south() + (row + 0.5) * (b.north() - b.south()) / h;
            for (int col = 0; col < w; col++) {
                double lon = b.west() + (col + 0.5) * (b.east() - b.west()) / w;
                if (d.contains(lat, lon)) {
                    sum += values.get(row * w + col);
                    count++;
                }
            }
        }
        if (count > 0) {
            return round1(sum / count);
        }
        int col = clampIndex((d.centerLon() - b.west()) / (b.east() - b.west()) * w, w);
        int row = clampIndex((d.centerLat() - b.south()) / (b.north() - b.south()) * h, h);
        return round1(values.get(row * w + col));
    }

    private static int clampIndex(double raw, int size) {
        return Math.min(Math.max((int) Math.floor(raw), 0), size - 1);
    }

    private static Double round1(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    private static Double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
