package com.airvision.backend.site;

import com.airvision.backend.common.NotFoundException;
import com.airvision.backend.site.dto.SiteRequest;
import com.airvision.backend.site.dto.SiteResponse;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class SiteService {

    private final ObservationSiteRepository siteRepository;

    public SiteService(ObservationSiteRepository siteRepository) {
        this.siteRepository = siteRepository;
    }

    public List<SiteResponse> findAll() {
        return siteRepository.findAll().stream().map(SiteResponse::from).toList();
    }

    public SiteResponse findById(Long id) {
        ObservationSite site = getSiteOrThrow(id);
        String geomWkt = siteRepository.findGeomWkt(id).orElse(null);
        return SiteResponse.from(site, geomWkt);
    }

    @Transactional
    public SiteResponse create(SiteRequest request) {
        ObservationSite site = new ObservationSite(
                request.name(), request.latitude(), request.longitude(),
                request.altitude(), request.siteType(), request.description());
        return SiteResponse.from(siteRepository.save(site));
    }

    @Transactional
    public SiteResponse update(Long id, SiteRequest request) {
        ObservationSite site = getSiteOrThrow(id);
        site.update(request.name(), request.latitude(), request.longitude(),
                request.altitude(), request.siteType(), request.description());
        return SiteResponse.from(site);
    }

    @Transactional
    public void delete(Long id) {
        ObservationSite site = getSiteOrThrow(id);
        siteRepository.delete(site);
    }

    public ObservationSite getSiteOrThrow(Long id) {
        return siteRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("관측소", id));
    }
}
