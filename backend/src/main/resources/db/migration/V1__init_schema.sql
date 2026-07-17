-- =============================================================
-- AirVision 3D 초기 스키마 (V1)
-- 전제: 대상 DB에 PostGIS 확장이 활성화되어 있어야 한다.
--       (database/setup/01-enable-postgis.sql 참고)
-- geom 컬럼은 latitude/longitude로부터 자동 생성(GENERATED)되므로
-- 애플리케이션은 위도/경도만 저장하면 된다.
-- =============================================================

-- 사용자 (일반 사용자 / 관리자)
CREATE TABLE users (
    id            BIGSERIAL PRIMARY KEY,
    username      VARCHAR(50)  NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name          VARCHAR(100) NOT NULL,
    role          VARCHAR(20)  NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN')),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 관측소 (센서 위치, CCTV/이미지 촬영 위치)
CREATE TABLE observation_sites (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    latitude    DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude   DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    altitude    DOUBLE PRECISION,
    site_type   VARCHAR(30) NOT NULL DEFAULT 'SENSOR',
    description TEXT,
    geom        GEOMETRY(Point, 4326) GENERATED ALWAYS AS
                (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)) STORED,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_observation_sites_geom ON observation_sites USING GIST (geom);

-- 관측값 (센서 측정치)
CREATE TABLE observations (
    id             BIGSERIAL PRIMARY KEY,
    site_id        BIGINT NOT NULL REFERENCES observation_sites (id) ON DELETE CASCADE,
    observed_at    TIMESTAMPTZ NOT NULL,
    pm10           DOUBLE PRECISION CHECK (pm10 >= 0),
    pm25           DOUBLE PRECISION CHECK (pm25 >= 0),
    temperature    DOUBLE PRECISION,
    humidity       DOUBLE PRECISION CHECK (humidity BETWEEN 0 AND 100),
    wind_speed     DOUBLE PRECISION CHECK (wind_speed >= 0),
    wind_direction DOUBLE PRECISION CHECK (wind_direction >= 0 AND wind_direction < 360),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_observations_site_time UNIQUE (site_id, observed_at)
);

CREATE INDEX idx_observations_observed_at ON observations (observed_at);
CREATE INDEX idx_observations_site_time ON observations (site_id, observed_at DESC);

-- 대기 이미지 (원본/ROI/보정 경로)
CREATE TABLE images (
    id             BIGSERIAL PRIMARY KEY,
    site_id        BIGINT NOT NULL REFERENCES observation_sites (id) ON DELETE CASCADE,
    captured_at    TIMESTAMPTZ NOT NULL,
    original_path  VARCHAR(500) NOT NULL,
    roi_path       VARCHAR(500),
    corrected_path VARCHAR(500),
    roi_x          INTEGER CHECK (roi_x >= 0),
    roi_y          INTEGER CHECK (roi_y >= 0),
    roi_width      INTEGER CHECK (roi_width > 0),
    roi_height     INTEGER CHECK (roi_height > 0),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_images_site_captured ON images (site_id, captured_at DESC);

-- AI 모델 메타데이터
CREATE TABLE ai_models (
    id           BIGSERIAL PRIMARY KEY,
    model_name   VARCHAR(100) NOT NULL,
    architecture VARCHAR(50)  NOT NULL,
    version      VARCHAR(30)  NOT NULL,
    model_path   VARCHAR(500) NOT NULL,
    config_json  JSONB,
    is_active    BOOLEAN NOT NULL DEFAULT false,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_ai_models_name_version UNIQUE (model_name, version)
);

-- 모델 성능지표 (실험 단위)
CREATE TABLE model_metrics (
    id              BIGSERIAL PRIMARY KEY,
    model_id        BIGINT NOT NULL REFERENCES ai_models (id) ON DELETE CASCADE,
    experiment_name VARCHAR(100),
    mae             DOUBLE PRECISION,
    rmse            DOUBLE PRECISION,
    mape            DOUBLE PRECISION,
    r2_score        DOUBLE PRECISION,
    grade_accuracy  DOUBLE PRECISION,
    metrics_json    JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_model_metrics_model ON model_metrics (model_id);

-- AI 예측 결과
CREATE TABLE predictions (
    id              BIGSERIAL PRIMARY KEY,
    site_id         BIGINT NOT NULL REFERENCES observation_sites (id) ON DELETE CASCADE,
    image_id        BIGINT REFERENCES images (id) ON DELETE SET NULL,
    model_id        BIGINT NOT NULL REFERENCES ai_models (id) ON DELETE CASCADE,
    predicted_at    TIMESTAMPTZ NOT NULL,
    actual_pm25     DOUBLE PRECISION CHECK (actual_pm25 >= 0),
    predicted_pm25  DOUBLE PRECISION NOT NULL CHECK (predicted_pm25 >= 0),
    predicted_grade VARCHAR(20),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_predictions_site_time ON predictions (site_id, predicted_at DESC);
CREATE INDEX idx_predictions_predicted_at ON predictions (predicted_at);

-- IDW 보간 결과
CREATE TABLE interpolation_results (
    id              BIGSERIAL PRIMARY KEY,
    target_name     VARCHAR(100),
    latitude        DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude       DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    interpolated_at TIMESTAMPTZ NOT NULL,
    source_type     VARCHAR(30) NOT NULL DEFAULT 'OBSERVATION',
    algorithm       VARCHAR(30) NOT NULL DEFAULT 'IDW',
    power           DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    pm25            DOUBLE PRECISION NOT NULL CHECK (pm25 >= 0),
    geom            GEOMETRY(Point, 4326) GENERATED ALWAYS AS
                    (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)) STORED,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_interpolation_results_time ON interpolation_results (interpolated_at);
CREATE INDEX idx_interpolation_results_geom ON interpolation_results USING GIST (geom);
