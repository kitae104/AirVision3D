-- 데모/시연용 합성 관측값 재생성 (현재 시각 기준 최근 7일, 1시간 간격).
-- 정적 시드(V2__seed_sample_data.sql)가 시간이 지나 조회 창을 벗어나는 것을 보완한다.
-- 삭제 없이 빠진 시간대만 채운다(ON CONFLICT DO NOTHING) → 실사용 데이터 훼손 없음.
-- SampleObservationReseeder가 airvision.sample.reseed=true 일 때 실행한다.
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
