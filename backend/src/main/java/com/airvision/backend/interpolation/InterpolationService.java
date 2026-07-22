package com.airvision.backend.interpolation;

import com.airvision.backend.common.PageResponse;
import com.airvision.backend.interpolation.IdwInterpolator.SourcePoint;
import com.airvision.backend.interpolation.dto.InterpolationRequest;
import com.airvision.backend.interpolation.dto.InterpolationResponse;
import com.airvision.backend.observation.ObservationRepository;
import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class InterpolationService {

    private final ObservationRepository observationRepository;
    private final InterpolationResultRepository resultRepository;

    public InterpolationService(ObservationRepository observationRepository,
                                InterpolationResultRepository resultRepository) {
        this.observationRepository = observationRepository;
        this.resultRepository = resultRepository;
    }

    /**
     * 관측소별 최신 PM2.5를 관측지점으로 사용해 대상 위치들의 값을 IDW로 보간하고 저장한다.
     */
    @Transactional
    public List<InterpolationResponse> run(InterpolationRequest request) {
        Instant baseTime = request.observedAt() != null ? request.observedAt() : Instant.now();
        double power = request.powerOrDefault();
        String method = request.methodOrDefault();

        List<SourcePoint> sources = observationRepository.findLatestPm25PerSite(baseTime).stream()
                .map(s -> new SourcePoint(s.getLatitude(), s.getLongitude(), s.getPm25()))
                .toList();
        if (sources.isEmpty()) {
            throw new IllegalStateException("기준 시각 이전의 PM2.5 관측값이 없어 보간할 수 없습니다");
        }

        // Modified IDW의 보정값은 대상 지점과 무관하므로 한 번만 계산해 재사용한다
        double[] corrections = "MODIFIED_IDW".equals(method)
                ? ModifiedIdwInterpolator.corrections(sources, power)
                : null;

        List<InterpolationResult> results = request.targets().stream()
                .map(target -> {
                    double pm25 = corrections != null
                            ? ModifiedIdwInterpolator.estimate(
                                    sources, corrections, target.latitude(), target.longitude(), power)
                            : IdwInterpolator.interpolate(
                                    sources, target.latitude(), target.longitude(), power);
                    return new InterpolationResult(
                            target.name(), target.latitude(), target.longitude(),
                            baseTime, "OBSERVATION", method, power, round(pm25));
                })
                .toList();

        return resultRepository.saveAll(results).stream()
                .map(InterpolationResponse::from)
                .toList();
    }

    public PageResponse<InterpolationResponse> findRecent(int page, int size) {
        var result = resultRepository
                .findAllByOrderByCreatedAtDesc(PageRequest.of(page, size))
                .map(InterpolationResponse::from);
        return PageResponse.from(result);
    }

    /** 저장 값은 소수점 4자리로 반올림한다 (μg/m³ 표시 정밀도보다 충분히 높음). */
    private static double round(double value) {
        return Math.round(value * 10_000.0) / 10_000.0;
    }
}
