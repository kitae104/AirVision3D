-- =============================================================
-- 인천 핵심 대상지 관측소 시드 (V4)
-- 프로젝트 타겟 지역 확정(2026-07-22): 인천, 특히 미추홀구·남동구·연수구.
-- 최종보고서(사업대상지 중심 운영)에 맞춰 핵심 3구에 자체 관측소 6곳을 추가하고
-- V2와 동일한 방식의 합성 관측값(최근 7일, 1시간 간격)을 생성한다.
-- 기존 데이터는 삭제하지 않는다(ON CONFLICT DO NOTHING).
-- =============================================================

INSERT INTO observation_sites (name, latitude, longitude, altitude, site_type, description)
VALUES
    ('미추홀주안', 37.4646, 126.6803, 22, 'SENSOR', '인천 미추홀구 주안역 일대 관측소'),
    ('미추홀용현', 37.4512, 126.6537, 15, 'CCTV',   '인천 미추홀구 용현동, 이미지 촬영 지점'),
    ('남동구월',   37.4487, 126.7016, 30, 'SENSOR', '인천 남동구 구월동 도심 관측소'),
    ('남동논현',   37.4013, 126.7300, 10, 'SENSOR', '인천 남동구 논현동 해안 관측소'),
    ('연수동춘',   37.4090, 126.6660, 18, 'SENSOR', '인천 연수구 동춘동 관측소'),
    ('연수송도',   37.3925, 126.6350, 8,  'CCTV',   '인천 연수구 송도 센트럴파크, 이미지 촬영 지점')
ON CONFLICT (name) DO NOTHING;

-- 신규 관측소에 한해 최근 7일, 1시간 간격 합성 관측값 생성 (V2와 동일한 생성식)
INSERT INTO observations (site_id, observed_at, pm10, pm25, temperature, humidity, wind_speed, wind_direction)
SELECT
    s.id,
    t,
    -- pm10: pm25보다 큰 값으로 생성
    ROUND(GREATEST(5,
        45 + 25 * SIN(EXTRACT(EPOCH FROM t) / 86400.0 * 2 * PI() + s.id)
           + (random() * 20 - 10))::numeric, 1),
    -- pm25: 일 주기 사인파(관측소별 위상차) + 잡음
    ROUND(GREATEST(2,
        25 + 15 * SIN(EXTRACT(EPOCH FROM t) / 86400.0 * 2 * PI() + s.id)
           + (random() * 12 - 6))::numeric, 1),
    -- 기온: 일 주기 (새벽 최저, 오후 최고)
    ROUND((22 + 6 * SIN((EXTRACT(HOUR FROM t) - 9) / 24.0 * 2 * PI())
             + (random() * 2 - 1))::numeric, 1),
    -- 습도: 기온과 반대 위상
    ROUND(LEAST(100, GREATEST(20,
        60 - 15 * SIN((EXTRACT(HOUR FROM t) - 9) / 24.0 * 2 * PI())
           + (random() * 10 - 5)))::numeric, 1),
    -- 풍속
    ROUND((1.5 + random() * 3)::numeric, 1),
    -- 풍향
    ROUND((random() * 359.9)::numeric, 1)
FROM observation_sites s
CROSS JOIN generate_series(
    date_trunc('hour', now()) - INTERVAL '7 days',
    date_trunc('hour', now()),
    INTERVAL '1 hour'
) AS t
WHERE s.name IN ('미추홀주안', '미추홀용현', '남동구월', '남동논현', '연수동춘', '연수송도')
ON CONFLICT ON CONSTRAINT uq_observations_site_time DO NOTHING;
