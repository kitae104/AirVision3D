-- 공공 데이터 시계열 누적 (설계: docs/superpowers/specs/2026-07-18-public-data-history-accumulation-design.md)
CREATE TABLE public_air_measurement (
    id             BIGSERIAL PRIMARY KEY,
    station_name   VARCHAR(100) NOT NULL,
    sido           VARCHAR(20),
    latitude       DOUBLE PRECISION,
    longitude      DOUBLE PRECISION,
    measured_at    TIMESTAMPTZ NOT NULL,
    pm10           DOUBLE PRECISION,
    pm25           DOUBLE PRECISION,
    o3             DOUBLE PRECISION,
    no2            DOUBLE PRECISION,
    co             DOUBLE PRECISION,
    so2            DOUBLE PRECISION,
    khai           DOUBLE PRECISION,
    pm10_grade     VARCHAR(10),
    pm25_grade     VARCHAR(10),
    collected_mock BOOLEAN NOT NULL DEFAULT FALSE,
    collected_at   TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_pam_station_time UNIQUE (station_name, measured_at)
);
CREATE INDEX idx_pam_sido_time ON public_air_measurement (sido, measured_at);

CREATE TABLE public_weather_observation (
    id             BIGSERIAL PRIMARY KEY,
    sido           VARCHAR(20),
    grid_x         INT NOT NULL,
    grid_y         INT NOT NULL,
    latitude       DOUBLE PRECISION,
    longitude      DOUBLE PRECISION,
    base_time      TIMESTAMPTZ NOT NULL,
    temperature    DOUBLE PRECISION,
    humidity       DOUBLE PRECISION,
    wind_speed     DOUBLE PRECISION,
    wind_direction_deg DOUBLE PRECISION,
    precipitation_type VARCHAR(20),
    collected_mock BOOLEAN NOT NULL DEFAULT FALSE,
    collected_at   TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_pwo_grid_time UNIQUE (grid_x, grid_y, base_time)
);
CREATE INDEX idx_pwo_sido_time ON public_weather_observation (sido, base_time);

CREATE TABLE comparison_history (
    id                 BIGSERIAL PRIMARY KEY,
    site_id            BIGINT,
    site_name          VARCHAR(100),
    predicted_at       TIMESTAMPTZ NOT NULL,
    predicted_pm25     DOUBLE PRECISION NOT NULL,
    station_name       VARCHAR(100),
    measured_at        TIMESTAMPTZ,
    measured_pm25      DOUBLE PRECISION,
    distance_km        DOUBLE PRECISION,
    time_diff_minutes  BIGINT,
    absolute_error     DOUBLE PRECISION,
    error_rate_percent DOUBLE PRECISION,
    matched            BOOLEAN NOT NULL DEFAULT TRUE,
    computed_at        TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_ch_snapshot UNIQUE (site_id, predicted_at, station_name, measured_at)
);
CREATE INDEX idx_ch_computed ON comparison_history (computed_at);
