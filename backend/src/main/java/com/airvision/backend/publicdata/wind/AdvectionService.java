package com.airvision.backend.publicdata.wind;

import com.airvision.backend.interpolation.IdwInterpolator;
import com.airvision.backend.publicdata.airkorea.AirKoreaService;
import com.airvision.backend.publicdata.airkorea.dto.CurrentAirQualityResponse;
import com.airvision.backend.publicdata.airkorea.dto.PollutantValue;
import com.airvision.backend.publicdata.airkorea.dto.StationAirQuality;
import com.airvision.backend.publicdata.wind.dto.AdvectionResponse;
import com.airvision.backend.publicdata.wind.dto.WindFieldResponse;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.function.Function;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * 현재 미세먼지 분포(AirKorea 실측 IDW)를 바람장으로 이동시키는 semi-Lagrangian 이류 예측.
 * 확산·배출·침적은 포함하지 않는 순수 이류(advection-only) 모델이다.
 * PM2.5를 기본으로 하고, 유효한 PM10 실측이 있으면 같은 바람장으로 PM10도 병행 이류한다.
 * 도메인이 수도권으로 넓어도 강풍이 지속되면 경계 유입값(clamp)이 수 시간 내 지배하는 한계가 있다.
 */
@Service
public class AdvectionService {

    private static final Logger log = LoggerFactory.getLogger(AdvectionService.class);

    static final String MODEL = "advection-only";
    static final double IDW_POWER = 2.0;
    static final double M_PER_DEG_LAT = 111_320.0;
    static final double STEP_SECONDS = 3600.0;
    /** 수도권 도메인 초기 농도장에 쓰는 실측 시도 (일부 실패해도 나머지로 계속). */
    static final List<String> SIDOS = List.of("인천", "서울", "경기");

    private final WindFieldService windFieldService;
    private final AirKoreaService airKoreaService;

    public AdvectionService(WindFieldService windFieldService, AirKoreaService airKoreaService) {
        this.windFieldService = windFieldService;
        this.airKoreaService = airKoreaService;
    }

    public AdvectionResponse advect(int hours) {
        if (hours < 1 || hours > 6) {
            throw new IllegalArgumentException("hours는 1~6 범위여야 합니다");
        }
        WindFieldResponse wind = windFieldService.field();
        if (wind.hours().isEmpty()) {
            throw new IllegalStateException("바람 예보가 없어 이동 예측을 할 수 없습니다");
        }
        CurrentAirQualityResponse current = mergedCurrent();
        List<IdwInterpolator.SourcePoint> pm25Sources =
                sources(current, StationAirQuality::pm25);
        List<IdwInterpolator.SourcePoint> pm10Sources =
                sources(current, StationAirQuality::pm10);
        if (pm25Sources.isEmpty()) {
            throw new IllegalStateException("유효한 실측 측정소가 없어 이동 예측을 할 수 없습니다");
        }

        int w = wind.width();
        int h = wind.height();
        WindFieldResponse.Bounds b = wind.bounds();
        double[] pm25Field = initialField(pm25Sources, w, h, b);
        double[] pm10Field = pm10Sources.isEmpty() ? null : initialField(pm10Sources, w, h, b);

        List<AdvectionResponse.Frame> frames = new ArrayList<>();
        for (int step = 1; step <= hours; step++) {
            WindFieldResponse.HourField hour =
                    wind.hours().get(Math.min(step - 1, wind.hours().size() - 1));
            pm25Field = advectStep(pm25Field, hour.u(), hour.v(), w, h, b);
            if (pm10Field != null) {
                pm10Field = advectStep(pm10Field, hour.u(), hour.v(), w, h, b);
            }
            frames.add(new AdvectionResponse.Frame(hour.time(),
                    rounded(pm25Field), pm10Field == null ? null : rounded(pm10Field)));
        }
        return new AdvectionResponse(b, w, h, MODEL,
                wind.mock() || current.mock(), frames);
    }

    /**
     * 인천·서울·경기 실측을 병합해 수도권 초기 농도장 소스를 만든다.
     * 측정소명 기준으로 중복을 제거하고, 일부 시도 조회가 실패해도 나머지로 진행한다.
     */
    private CurrentAirQualityResponse mergedCurrent() {
        List<StationAirQuality> stations = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        CurrentAirQualityResponse first = null;
        boolean mock = false;
        RuntimeException lastError = null;
        for (String sido : SIDOS) {
            CurrentAirQualityResponse res;
            try {
                res = airKoreaService.current(sido);
            } catch (RuntimeException e) {
                log.warn("{} 실시간 대기질 조회 실패 — 나머지 시도로 계속: {}", sido, e.getMessage());
                lastError = e;
                continue;
            }
            if (first == null) {
                first = res;
            }
            mock = mock || res.mock();
            for (StationAirQuality s : res.stations()) {
                if (seen.add(s.stationName())) {
                    stations.add(s);
                }
            }
        }
        if (first == null) {
            throw lastError != null ? lastError
                    : new IllegalStateException("실시간 대기질을 조회할 수 없습니다");
        }
        return new CurrentAirQualityResponse("수도권", first.source(), mock,
                first.stale(), first.collectedAt(), first.message(), stations);
    }

    /** 좌표·측정값이 유효한 측정소만 IDW 소스로 변환. (DistrictForecastService에서도 재사용) */
    static List<IdwInterpolator.SourcePoint> sources(
            CurrentAirQualityResponse current,
            Function<StationAirQuality, PollutantValue> pollutant) {
        List<IdwInterpolator.SourcePoint> result = new ArrayList<>();
        for (StationAirQuality s : current.stations()) {
            PollutantValue value = pollutant.apply(s);
            if (s.locationAvailable() && s.latitude() != null && s.longitude() != null
                    && value != null && value.valid() && value.value() != null) {
                result.add(new IdwInterpolator.SourcePoint(
                        s.latitude(), s.longitude(), value.value()));
            }
        }
        return result;
    }

    /** 실측 지점 IDW로 초기 농도장을 만든다 (row 0 = 남쪽). */
    private static double[] initialField(List<IdwInterpolator.SourcePoint> sources,
                                         int w, int h, WindFieldResponse.Bounds b) {
        double[] field = new double[w * h];
        for (int row = 0; row < h; row++) {
            double lat = b.south() + (row + 0.5) * (b.north() - b.south()) / h;
            for (int col = 0; col < w; col++) {
                double lon = b.west() + (col + 0.5) * (b.east() - b.west()) / w;
                field[row * w + col] = IdwInterpolator.interpolate(sources, lat, lon, IDW_POWER);
            }
        }
        return field;
    }

    private static List<Double> rounded(double[] field) {
        List<Double> result = new ArrayList<>(field.length);
        for (double value : field) {
            result.add(Math.round(value * 10.0) / 10.0);
        }
        return result;
    }

    /** 1시간 semi-Lagrangian 역추적: 각 셀에서 바람을 거슬러 출발점 농도를 bilinear 샘플링. */
    static double[] advectStep(double[] field, List<Double> u, List<Double> v,
                               int width, int height, WindFieldResponse.Bounds bounds) {
        double[] next = new double[width * height];
        for (int row = 0; row < height; row++) {
            double lat = bounds.south() + (row + 0.5) * (bounds.north() - bounds.south()) / height;
            for (int col = 0; col < width; col++) {
                double lon = bounds.west() + (col + 0.5) * (bounds.east() - bounds.west()) / width;
                int idx = row * width + col;
                double mPerDegLon = M_PER_DEG_LAT * Math.cos(Math.toRadians(lat));
                double depLat = lat - v.get(idx) * STEP_SECONDS / M_PER_DEG_LAT;
                double depLon = lon - u.get(idx) * STEP_SECONDS / mPerDegLon;
                next[idx] = bilinear(field, width, height, bounds, depLat, depLon);
            }
        }
        return next;
    }

    /** 격자 밖 좌표는 경계 셀로 클램프한 bilinear 샘플링. */
    static double bilinear(double[] field, int width, int height,
                           WindFieldResponse.Bounds bounds, double lat, double lon) {
        double x = (lon - bounds.west()) / (bounds.east() - bounds.west()) * width - 0.5;
        double y = (lat - bounds.south()) / (bounds.north() - bounds.south()) * height - 0.5;
        x = Math.min(Math.max(x, 0), width - 1);
        y = Math.min(Math.max(y, 0), height - 1);
        int x0 = (int) Math.floor(x);
        int y0 = (int) Math.floor(y);
        int x1 = Math.min(x0 + 1, width - 1);
        int y1 = Math.min(y0 + 1, height - 1);
        double fx = x - x0;
        double fy = y - y0;
        return field[y0 * width + x0] * (1 - fx) * (1 - fy)
                + field[y0 * width + x1] * fx * (1 - fy)
                + field[y1 * width + x0] * (1 - fx) * fy
                + field[y1 * width + x1] * fx * fy;
    }
}
