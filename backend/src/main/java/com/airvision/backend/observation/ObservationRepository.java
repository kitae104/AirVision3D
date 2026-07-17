package com.airvision.backend.observation;

import java.time.Instant;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface ObservationRepository
        extends JpaRepository<Observation, Long>, JpaSpecificationExecutor<Observation> {

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
