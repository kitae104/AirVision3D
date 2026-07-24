package com.airvision.backend.prediction;

import com.airvision.backend.ai.AiServiceClient;
import com.airvision.backend.common.GeoUtils;
import com.airvision.backend.common.SolarUtils;
import com.airvision.backend.dashboard.GradeProperties;
import com.airvision.backend.prediction.dto.CctvEstimateResponse;
import com.airvision.backend.publicdata.airkorea.AirKoreaService;
import com.airvision.backend.publicdata.airkorea.dto.CurrentAirQualityResponse;
import com.airvision.backend.publicdata.airkorea.dto.StationAirQuality;
import com.airvision.backend.publicdata.kma.KmaWeatherService;
import com.airvision.backend.site.ObservationSite;
import com.airvision.backend.site.SiteService;
import java.time.Clock;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/**
 * CCTV 정지 이미지 기반 미세먼지·가시거리 추정.
 *
 * <p>주간: AI 이미지 추론(PM2.5) + 최근접 실측 PM10/PM2.5 비율로 PM10 추정.
 * 야간(태양고도 &lt; 임계값): 이미지가 어두워 추론 신뢰도가 없으므로
 * 최근접 AirKorea 측정소 실측값으로 대체(fallback)한다.</p>
 *
 * <p>가시거리는 Koschmieder 식 V=3.912/bext에 간이 소산계수
 * bext = 0.0134(Rayleigh) + 0.0039·PM2.5 [1/km]를 적용한 추정치로,
 * 습도에 따른 입자 성장 효과는 반영하지 않는 간이 지표다.</p>
 */
@Service
public class CctvEstimateService {

    private static final Logger log = LoggerFactory.getLogger(CctvEstimateService.class);

    /** 이 태양고도(도) 미만이면 야간으로 보고 실측 대체를 사용한다. */
    static final double NIGHT_ELEVATION_DEG = 0.0;
    /** 가시거리 추정 상한/하한 (km). */
    static final double VISIBILITY_MAX_KM = 20.0;
    static final double VISIBILITY_MIN_KM = 0.1;

    private final AiServiceClient aiClient;
    private final SiteService siteService;
    private final AirKoreaService airKoreaService;
    private final KmaWeatherService kmaWeatherService;
    private final GradeProperties gradeProperties;
    private final Clock clock;

    @org.springframework.beans.factory.annotation.Autowired
    public CctvEstimateService(AiServiceClient aiClient, SiteService siteService,
                               AirKoreaService airKoreaService,
                               KmaWeatherService kmaWeatherService,
                               GradeProperties gradeProperties) {
        this(aiClient, siteService, airKoreaService, kmaWeatherService, gradeProperties,
                Clock.systemUTC());
    }

    CctvEstimateService(AiServiceClient aiClient, SiteService siteService,
                        AirKoreaService airKoreaService, KmaWeatherService kmaWeatherService,
                        GradeProperties gradeProperties, Clock clock) {
        this.aiClient = aiClient;
        this.siteService = siteService;
        this.airKoreaService = airKoreaService;
        this.kmaWeatherService = kmaWeatherService;
        this.gradeProperties = gradeProperties;
        this.clock = clock;
    }

    public CctvEstimateResponse estimate(Long siteId, String modelName, MultipartFile image,
                                         double temperature, double humidity) {
        ObservationSite site = siteService.getSiteOrThrow(siteId);
        Instant now = clock.instant();
        double elevation = SolarUtils.solarElevationDeg(
                site.getLatitude(), site.getLongitude(), now);
        boolean night = elevation < NIGHT_ELEVATION_DEG;
        StationAirQuality nearest = nearestValidStation(site);

        if (night) {
            if (nearest == null) {
                throw new IllegalStateException(
                        "야간(태양고도 %.1f도)이라 이미지 추론을 사용할 수 없고, "
                                .formatted(elevation)
                                + "대체할 유효한 실측 측정소도 없습니다");
            }
            double pm25 = nearest.pm25().value();
            Double pm10 = validValue(nearest.pm10());
            return new CctvEstimateResponse(siteId, modelName, "STATION_FALLBACK", true,
                    round2(elevation), pm25, pm10, gradeProperties.gradeOf(pm25),
                    visibilityKm(pm25), nearest.stationName(), now);
        }

        AiServiceClient.PredictData result = aiClient.predict(
                modelName, image, temperature, humidity, windSpeedAt(site),
                site.getLatitude(), site.getLongitude(), now);
        Double pm10 = estimatePm10(result.pm25(), nearest);
        return new CctvEstimateResponse(siteId, modelName, "AI_IMAGE", false,
                round2(elevation), result.pm25(), pm10, result.grade(),
                visibilityKm(result.pm25()),
                nearest == null ? null : nearest.stationName(), now);
    }

    /** AI 입력용 풍속: 기상청 실황 조회, 실패 시 0.0 (추론 자체는 계속 진행). */
    private double windSpeedAt(ObservationSite site) {
        try {
            Double windSpeed = kmaWeatherService
                    .current(site.getLatitude(), site.getLongitude()).windSpeed();
            return windSpeed == null ? 0.0 : windSpeed;
        } catch (RuntimeException e) {
            log.warn("기상 조회 실패 — 풍속 0으로 추론 진행: {}", e.getMessage());
            return 0.0;
        }
    }

    /** PM2.5 실측이 유효한 최근접 측정소. 실패·부재 시 null (호출부에서 분기). */
    private StationAirQuality nearestValidStation(ObservationSite site) {
        CurrentAirQualityResponse current;
        try {
            current = airKoreaService.current("인천");
        } catch (RuntimeException e) {
            log.warn("실측 조회 실패 — PM10/야간 대체 불가: {}", e.getMessage());
            return null;
        }
        StationAirQuality nearest = null;
        double nearestKm = Double.MAX_VALUE;
        for (StationAirQuality s : current.stations()) {
            if (!s.locationAvailable() || s.latitude() == null || s.longitude() == null
                    || s.pm25() == null || !s.pm25().valid() || s.pm25().value() == null) {
                continue;
            }
            double km = GeoUtils.haversineKm(site.getLatitude(), site.getLongitude(),
                    s.latitude(), s.longitude());
            if (km < nearestKm) {
                nearestKm = km;
                nearest = s;
            }
        }
        return nearest;
    }

    /** 최근접 실측의 PM10/PM2.5 비율로 PM10을 추정한다 (비율 산출 불가 시 null). */
    private static Double estimatePm10(double predictedPm25, StationAirQuality nearest) {
        if (nearest == null) {
            return null;
        }
        Double pm10 = validValue(nearest.pm10());
        double pm25 = nearest.pm25().value();
        if (pm10 == null || pm25 <= 0) {
            return null;
        }
        return round1(predictedPm25 * (pm10 / pm25));
    }

    /** Koschmieder 간이 가시거리 추정 (km, 0.1~20 클램프). */
    static Double visibilityKm(double pm25) {
        double bextPerKm = 0.0134 + 0.0039 * Math.max(pm25, 0);
        double visibility = 3.912 / bextPerKm;
        return round1(Math.min(Math.max(visibility, VISIBILITY_MIN_KM), VISIBILITY_MAX_KM));
    }

    private static Double validValue(com.airvision.backend.publicdata.airkorea.dto.PollutantValue v) {
        return v != null && v.valid() ? v.value() : null;
    }

    private static Double round1(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    private static Double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
