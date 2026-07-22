package com.airvision.backend.publicdata.interpolation;

import com.airvision.backend.dashboard.GradeProperties;
import com.airvision.backend.interpolation.IdwInterpolator;
import com.airvision.backend.interpolation.ModifiedIdwInterpolator;
import com.airvision.backend.publicdata.airkorea.AirKoreaService;
import com.airvision.backend.publicdata.airkorea.dto.CurrentAirQualityResponse;
import com.airvision.backend.publicdata.airkorea.dto.StationAirQuality;
import com.airvision.backend.publicdata.interpolation.dto.IdwGridCell;
import com.airvision.backend.publicdata.interpolation.dto.IdwGridResponse;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * AirKorea 실시간 실측을 소스로 시도 영역을 N×N IDW 보간해 현재 PM2.5 격자 표면을 만든다.
 * 저장하지 않고 매 요청마다 즉석 계산한다. IdwInterpolator(교차검증 완료)를 그대로 재사용한다.
 */
@Service
public class PublicIdwService {

    static final double DEFAULT_POWER = 2.0;
    static final int DEFAULT_RESOLUTION = 12;
    static final int MAX_RESOLUTION = 20;
    private static final double MIN_MARGIN_DEG = 0.05;
    private static final double MARGIN_RATIO = 0.10;

    private final AirKoreaService airKoreaService;
    private final GradeProperties gradeProperties;

    public PublicIdwService(AirKoreaService airKoreaService, GradeProperties gradeProperties) {
        this.airKoreaService = airKoreaService;
        this.gradeProperties = gradeProperties;
    }

    public IdwGridResponse grid(String sido, Double power, Integer resolution) {
        return grid(sido, power, resolution, null);
    }

    public IdwGridResponse grid(String sido, Double power, Integer resolution, String method) {
        double p = validatePower(power);
        int n = validateResolution(resolution);
        String m = validateMethod(method);
        CurrentAirQualityResponse current = airKoreaService.current(sido);

        List<IdwInterpolator.SourcePoint> sources = new ArrayList<>();
        for (StationAirQuality s : current.stations()) {
            if (s.locationAvailable() && s.latitude() != null && s.longitude() != null
                    && s.pm25() != null && s.pm25().valid() && s.pm25().value() != null) {
                sources.add(new IdwInterpolator.SourcePoint(
                        s.latitude(), s.longitude(), s.pm25().value()));
            }
        }
        if (sources.isEmpty()) {
            throw new IllegalStateException(
                    "유효한 실측 측정소가 없어 보간할 수 없습니다 (sido=" + current.sido() + ")");
        }

        double minLat = sources.stream().mapToDouble(IdwInterpolator.SourcePoint::latitude)
                .min().getAsDouble();
        double maxLat = sources.stream().mapToDouble(IdwInterpolator.SourcePoint::latitude)
                .max().getAsDouble();
        double minLon = sources.stream().mapToDouble(IdwInterpolator.SourcePoint::longitude)
                .min().getAsDouble();
        double maxLon = sources.stream().mapToDouble(IdwInterpolator.SourcePoint::longitude)
                .max().getAsDouble();
        double latMargin = Math.max(MIN_MARGIN_DEG, (maxLat - minLat) * MARGIN_RATIO);
        double lonMargin = Math.max(MIN_MARGIN_DEG, (maxLon - minLon) * MARGIN_RATIO);
        minLat -= latMargin;
        maxLat += latMargin;
        minLon -= lonMargin;
        maxLon += lonMargin;

        double latSpan = maxLat - minLat;
        double lonSpan = maxLon - minLon;
        // Modified IDW 보정값은 셀과 무관하므로 격자 전체에서 한 번만 계산한다
        double[] corrections = "MODIFIED_IDW".equals(m)
                ? ModifiedIdwInterpolator.corrections(sources, p)
                : null;

        List<IdwGridCell> cells = new ArrayList<>(n * n);
        for (int i = 0; i < n; i++) {
            double cellLat = minLat + (i + 0.5) * latSpan / n;
            for (int j = 0; j < n; j++) {
                double cellLon = minLon + (j + 0.5) * lonSpan / n;
                double raw = corrections != null
                        ? ModifiedIdwInterpolator.estimate(sources, corrections, cellLat, cellLon, p)
                        : IdwInterpolator.interpolate(sources, cellLat, cellLon, p);
                double pm25 = Math.round(raw * 10.0) / 10.0;
                cells.add(new IdwGridCell(cellLat, cellLon, pm25, gradeProperties.gradeOf(pm25)));
            }
        }

        return new IdwGridResponse(current.sido(), p, n, m, "AIRKOREA",
                current.mock(), current.stale(), sources.size(),
                new IdwGridResponse.Bbox(minLat, minLon, maxLat, maxLon), cells);
    }

    private static String validateMethod(String method) {
        if (method == null || method.isBlank()) {
            return "IDW";
        }
        if (!method.equals("IDW") && !method.equals("MODIFIED_IDW")) {
            throw new IllegalArgumentException("method는 IDW 또는 MODIFIED_IDW여야 합니다");
        }
        return method;
    }

    private static double validatePower(Double power) {
        double p = power == null ? DEFAULT_POWER : power;
        if (p < 0.1 || p > 10) {
            throw new IllegalArgumentException("power는 0.1~10 범위여야 합니다");
        }
        return p;
    }

    private static int validateResolution(Integer resolution) {
        int n = resolution == null ? DEFAULT_RESOLUTION : resolution;
        if (n < 2 || n > MAX_RESOLUTION) {
            throw new IllegalArgumentException("resolution은 2~" + MAX_RESOLUTION + " 범위여야 합니다");
        }
        return n;
    }
}
