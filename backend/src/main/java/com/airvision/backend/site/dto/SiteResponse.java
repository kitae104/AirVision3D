package com.airvision.backend.site.dto;

import com.airvision.backend.site.ObservationSite;
import java.time.Instant;

/** 관측소 응답. geomWkt는 상세 조회 시에만 채워진다 (PostGIS 검증용). */
public record SiteResponse(
        Long id,
        String name,
        double latitude,
        double longitude,
        Double altitude,
        String siteType,
        String description,
        String district,
        String geomWkt,
        Instant createdAt,
        Instant updatedAt
) {

    public static SiteResponse from(ObservationSite site) {
        return from(site, null);
    }

    public static SiteResponse from(ObservationSite site, String geomWkt) {
        return new SiteResponse(
                site.getId(),
                site.getName(),
                site.getLatitude(),
                site.getLongitude(),
                site.getAltitude(),
                site.getSiteType(),
                site.getDescription(),
                site.getDistrict(),
                geomWkt,
                site.getCreatedAt(),
                site.getUpdatedAt()
        );
    }
}
