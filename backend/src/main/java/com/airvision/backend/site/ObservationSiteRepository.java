package com.airvision.backend.site;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ObservationSiteRepository extends JpaRepository<ObservationSite, Long> {

    boolean existsByName(String name);

    /** PostGIS geom 컬럼을 WKT 문자열로 조회 (PostGIS 저장·조회 검증용). */
    @Query(value = "SELECT ST_AsText(geom) FROM observation_sites WHERE id = :id", nativeQuery = true)
    Optional<String> findGeomWkt(@Param("id") Long id);
}
