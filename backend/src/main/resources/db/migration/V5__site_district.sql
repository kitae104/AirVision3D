-- =============================================================
-- 관측소 구(행정구) 컬럼 추가 (V5, Phase 25: 대시보드 구 단위 필터)
-- 자체 관측소를 구 단위로 집계하기 위해 district 컬럼을 추가하고,
-- 인천 핵심 3구 시드 관측소(V4)와 V2의 인천송도(연수구 소재)에 값을 채운다.
-- 그 외 관측소(서울·수원·성남·고양)는 NULL 유지 → 구 필터에 포함되지 않는다.
-- =============================================================

ALTER TABLE observation_sites ADD COLUMN IF NOT EXISTS district VARCHAR(30);

UPDATE observation_sites SET district = '미추홀구' WHERE name IN ('미추홀주안', '미추홀용현');
UPDATE observation_sites SET district = '남동구'   WHERE name IN ('남동구월', '남동논현');
UPDATE observation_sites SET district = '연수구'   WHERE name IN ('연수동춘', '연수송도', '인천송도');
