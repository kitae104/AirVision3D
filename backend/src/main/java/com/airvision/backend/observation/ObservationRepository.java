package com.airvision.backend.observation;

import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ObservationRepository
        extends JpaRepository<Observation, Long>, JpaSpecificationExecutor<Observation> {

    /** 특정 관측소의 최신 관측값 (예측 결과의 actual_pm25 채움용). */
    java.util.Optional<Observation> findFirstBySite_IdOrderByObservedAtDesc(Long siteId);

    /** 관측소별 최신 PM2.5 (기준 시각 이전, pm25 존재 건만). IDW 보간의 관측지점 입력으로 사용. */
    interface SitePm25 {
        Long getSiteId();

        String getSiteName();

        Double getLatitude();

        Double getLongitude();

        Double getPm25();

        Instant getObservedAt();
    }

    /** 관측 데이터가 존재하는 시간 범위 (시계열 조회 기본값용). */
    interface TimeRange {
        Instant getMinTime();

        Instant getMaxTime();
    }

    @Query("SELECT MIN(o.observedAt) AS minTime, MAX(o.observedAt) AS maxTime FROM Observation o")
    TimeRange findObservedTimeRange();

    /** 기간 내 관측소별 PM2.5 시계열 (3D 시계열 시각화용). */
    interface SeriesRow {
        Long getSiteId();

        String getSiteName();

        Double getLatitude();

        Double getLongitude();

        Instant getObservedAt();

        Double getPm25();
    }

    @Query(value = """
            SELECT o.site_id     AS siteId,
                   s.name        AS siteName,
                   s.latitude    AS latitude,
                   s.longitude   AS longitude,
                   o.observed_at AS observedAt,
                   o.pm25        AS pm25
            FROM observations o
            JOIN observation_sites s ON s.id = o.site_id
            WHERE o.pm25 IS NOT NULL
              AND o.observed_at BETWEEN :from AND :to
            ORDER BY o.site_id, o.observed_at
            """, nativeQuery = true)
    List<SeriesRow> findSeries(@Param("from") Instant from, @Param("to") Instant to);

    /** 시간별 평균 PM2.5 (대시보드 차트용). */
    interface HourlyAvg {
        Instant getHour();

        Double getAvgPm25();
    }

    @Query(value = """
            SELECT date_trunc('hour', o.observed_at) AS hour,
                   AVG(o.pm25)                       AS avgPm25
            FROM observations o
            WHERE o.observed_at >= :from AND o.pm25 IS NOT NULL
            GROUP BY 1
            ORDER BY 1
            """, nativeQuery = true)
    List<HourlyAvg> findHourlyAveragePm25(@Param("from") Instant from);

    @Query(value = """
            SELECT DISTINCT ON (o.site_id)
                   o.site_id     AS siteId,
                   s.name        AS siteName,
                   s.latitude    AS latitude,
                   s.longitude   AS longitude,
                   o.pm25        AS pm25,
                   o.observed_at AS observedAt
            FROM observations o
            JOIN observation_sites s ON s.id = o.site_id
            WHERE o.pm25 IS NOT NULL
              AND o.observed_at <= :at
            ORDER BY o.site_id, o.observed_at DESC
            """, nativeQuery = true)
    List<SitePm25> findLatestPm25PerSite(@Param("at") Instant at);

    /** 관측소/기간 조건을 조합한 검색 조건 (null 파라미터는 조건에서 제외). */
    static Specification<Observation> search(Long siteId, Instant from, Instant to) {
        return (root, query, cb) -> {
            var predicates = cb.conjunction();
            if (siteId != null) {
                predicates = cb.and(predicates, cb.equal(root.get("site").get("id"), siteId));
            }
            if (from != null) {
                predicates = cb.and(predicates, cb.greaterThanOrEqualTo(root.get("observedAt"), from));
            }
            if (to != null) {
                predicates = cb.and(predicates, cb.lessThanOrEqualTo(root.get("observedAt"), to));
            }
            return predicates;
        };
    }
}
