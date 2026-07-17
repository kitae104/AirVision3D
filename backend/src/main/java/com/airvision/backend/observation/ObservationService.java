package com.airvision.backend.observation;

import com.airvision.backend.common.NotFoundException;
import com.airvision.backend.common.PageResponse;
import com.airvision.backend.observation.dto.ObservationRequest;
import com.airvision.backend.observation.dto.ObservationResponse;
import com.airvision.backend.site.SiteService;
import java.time.Instant;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ObservationService {

    private final ObservationRepository observationRepository;
    private final SiteService siteService;

    public ObservationService(ObservationRepository observationRepository, SiteService siteService) {
        this.observationRepository = observationRepository;
        this.siteService = siteService;
    }

    public PageResponse<ObservationResponse> search(Long siteId, Instant from, Instant to,
                                                    int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "observedAt"));
        var result = observationRepository
                .findAll(ObservationRepository.search(siteId, from, to), pageable)
                .map(ObservationResponse::from);
        return PageResponse.from(result);
    }

    public ObservationResponse findById(Long id) {
        return ObservationResponse.from(getObservationOrThrow(id));
    }

    @Transactional
    public ObservationResponse create(ObservationRequest request) {
        var site = siteService.getSiteOrThrow(request.siteId());
        Observation observation = new Observation(
                site, request.observedAt(), request.pm10(), request.pm25(),
                request.temperature(), request.humidity(), request.windSpeed(), request.windDirection());
        return ObservationResponse.from(observationRepository.save(observation));
    }

    @Transactional
    public ObservationResponse update(Long id, ObservationRequest request) {
        Observation observation = getObservationOrThrow(id);
        observation.update(request.observedAt(), request.pm10(), request.pm25(),
                request.temperature(), request.humidity(), request.windSpeed(), request.windDirection());
        return ObservationResponse.from(observation);
    }

    @Transactional
    public void delete(Long id) {
        Observation observation = getObservationOrThrow(id);
        observationRepository.delete(observation);
    }

    private Observation getObservationOrThrow(Long id) {
        return observationRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("관측값", id));
    }
}
