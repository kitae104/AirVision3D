# 데이터베이스 설계서

- DBMS: 원격 PostgreSQL 16 + PostGIS 3.4
- 마이그레이션: Flyway (`backend/src/main/resources/db/migration/`)
  - V1__init_schema.sql — 전체 스키마 (PostGIS 확장 활성화 포함)
  - V2__seed_sample_data.sql — 샘플 관측소 7곳 + 최근 7일 시간당 합성 관측값
- 초기 설정 절차: `database/setup/README.md`

## ERD

```mermaid
erDiagram
    users {
        bigserial id PK
        varchar username UK
        varchar password_hash
        varchar name
        varchar role "USER|ADMIN"
    }
    observation_sites {
        bigserial id PK
        varchar name UK
        double latitude
        double longitude
        double altitude
        varchar site_type "SENSOR|CCTV"
        geometry geom "GENERATED, GIST"
    }
    observations {
        bigserial id PK
        bigint site_id FK
        timestamptz observed_at "UK(site_id,observed_at)"
        double pm10
        double pm25
        double temperature
        double humidity
        double wind_speed
        double wind_direction
    }
    images {
        bigserial id PK
        bigint site_id FK
        timestamptz captured_at
        varchar original_path
        varchar roi_path
        varchar corrected_path
        int roi_x_y_w_h
    }
    ai_models {
        bigserial id PK
        varchar model_name "UK(name,version)"
        varchar architecture
        varchar version
        varchar model_path
        jsonb config_json
        boolean is_active
    }
    model_metrics {
        bigserial id PK
        bigint model_id FK
        varchar experiment_name
        double mae_rmse_mape_r2
        double grade_accuracy
        jsonb metrics_json
    }
    predictions {
        bigserial id PK
        bigint site_id FK
        bigint image_id FK "nullable"
        bigint model_id FK
        timestamptz predicted_at
        double actual_pm25
        double predicted_pm25
        varchar predicted_grade
    }
    interpolation_results {
        bigserial id PK
        varchar target_name
        double latitude
        double longitude
        timestamptz interpolated_at
        varchar algorithm "IDW"
        double power
        double pm25
        geometry geom "GENERATED, GIST"
    }

    observation_sites ||--o{ observations : "site_id (CASCADE)"
    observation_sites ||--o{ images : "site_id (CASCADE)"
    observation_sites ||--o{ predictions : "site_id (CASCADE)"
    images ||--o{ predictions : "image_id (SET NULL)"
    ai_models ||--o{ predictions : "model_id (CASCADE)"
    ai_models ||--o{ model_metrics : "model_id (CASCADE)"
```

## 설계 포인트

| 항목 | 내용 |
|---|---|
| 공간 컬럼 | `geom GEOMETRY(Point,4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude,latitude),4326)) STORED` — 앱은 좌표만 저장 |
| 공간 인덱스 | observation_sites.geom, interpolation_results.geom에 GIST |
| 시간 인덱스 | observations(observed_at), (site_id, observed_at DESC), predictions(site_id, predicted_at DESC), interpolation_results(interpolated_at) |
| 유일성 | users.username, observation_sites.name, observations(site_id, observed_at), ai_models(model_name, version) |
| CHECK 제약 | 좌표 범위, pm 값 ≥0, 습도 0~100, 풍향 0~360 미만, role 화이트리스트 |
| 시간 타입 | 전부 TIMESTAMPTZ (UTC 저장, 표시 시 로컬 변환) |
| 대표 쿼리 | 관측소별 최신값: `DISTINCT ON (site_id) ... ORDER BY site_id, observed_at DESC` |

## 엔티티 매핑 현황 (JPA)

| 테이블 | 엔티티 | 비고 |
|---|---|---|
| users | auth.User | |
| observation_sites | site.ObservationSite | geom 미매핑(DB 생성), WKT는 네이티브 조회 |
| observations | observation.Observation | LAZY site 연관 |
| ai_models | prediction.AiModel | config_json 미매핑(현재 미사용) |
| predictions | prediction.Prediction | image_id는 단순 컬럼(이미지 관리 도입 전) |
| interpolation_results | interpolation.InterpolationResult | geom 미매핑 |
| images / model_metrics | (미매핑) | 후속 단계에서 사용 시 매핑 |
