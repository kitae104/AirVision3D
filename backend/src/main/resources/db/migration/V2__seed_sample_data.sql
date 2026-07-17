-- =============================================================
-- 샘플 데이터 시드 (V2) - 교육용 MVP
-- 수도권 관측소 7곳 + 관측소별 최근 7일 시간당 관측값(합성 데이터).
-- pm25는 일 주기 사인파 + 잡음으로 생성하여 시계열 시각화 확인에 사용한다.
-- 운영 데이터로 전환할 때는 이 마이그레이션 내용을 비우고 재생성하면 된다.
-- =============================================================

INSERT INTO observation_sites (name, latitude, longitude, altitude, site_type, description)
VALUES
    ('서울시청',   37.5665, 126.9780, 38,  'SENSOR', '서울 중구 도심 관측소'),
    ('강남역',     37.4979, 127.0276, 45,  'SENSOR', '서울 강남 상업지구 관측소'),
    ('여의도공원', 37.5268, 126.9244, 12,  'CCTV',   '한강변 공원, 이미지 촬영 지점'),
    ('인천송도',   37.3894, 126.6435, 8,   'SENSOR', '인천 연수구 해안 관측소'),
    ('수원화성',   37.2871, 127.0119, 55,  'CCTV',   '수원 팔달구, 이미지 촬영 지점'),
    ('성남판교',   37.3948, 127.1112, 90,  'SENSOR', '성남 분당 판교 관측소'),
    ('고양일산',   37.6584, 126.7714, 25,  'SENSOR', '고양 일산서구 관측소')
ON CONFLICT (name) DO NOTHING;

-- 관측소별 최근 7일, 1시간 간격 관측값 생성
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
ON CONFLICT ON CONSTRAINT uq_observations_site_time DO NOTHING;
