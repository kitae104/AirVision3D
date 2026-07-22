"""태양고도 계산과 태양고도 특징 파이프라인 테스트."""

from datetime import datetime, timezone

import pytest

from app.common.solar import solar_elevation_deg
from app.data.dataset import EnvScaler
from app.data.schema import (
    ENV_FEATURE_COLUMNS,
    SOLAR_FEATURE_COLUMN,
    add_solar_altitude,
    load_labels_csv,
)

INCHEON = (37.45, 126.70)


class TestSolarElevation:

    def test_summer_noon_is_high(self):
        # 인천, 한여름 낮 13시(KST, naive) → 남중 부근 고도는 60도 이상
        elev = solar_elevation_deg(*INCHEON, datetime(2026, 7, 22, 13, 0))
        assert elev > 60

    def test_midnight_is_below_horizon(self):
        elev = solar_elevation_deg(*INCHEON, datetime(2026, 7, 22, 0, 0))
        assert elev < -20

    def test_winter_noon_lower_than_summer(self):
        summer = solar_elevation_deg(*INCHEON, datetime(2026, 7, 22, 13, 0))
        winter = solar_elevation_deg(*INCHEON, datetime(2026, 12, 22, 13, 0))
        assert winter < summer
        assert 20 < winter < 35  # 동지 남중고도 ≈ 90 - 37.45 - 23.44 ≈ 29도

    def test_aware_datetime_utc_equals_naive_kst(self):
        # naive(=KST 규약)와 동일 시각의 aware UTC는 같은 결과여야 한다
        naive_kst = solar_elevation_deg(*INCHEON, datetime(2026, 7, 22, 13, 0))
        aware_utc = solar_elevation_deg(
            *INCHEON, datetime(2026, 7, 22, 4, 0, tzinfo=timezone.utc))
        assert abs(naive_kst - aware_utc) < 1e-9

    def test_range_is_physical(self):
        for hour in range(24):
            elev = solar_elevation_deg(*INCHEON, datetime(2026, 7, 22, hour, 0))
            assert -90 <= elev <= 90

    def test_invalid_coordinates_raise(self):
        with pytest.raises(ValueError):
            solar_elevation_deg(91.0, 126.7, datetime(2026, 7, 22, 12, 0))
        with pytest.raises(ValueError):
            solar_elevation_deg(37.45, 181.0, datetime(2026, 7, 22, 12, 0))


class TestSolarFeaturePipeline:

    def test_add_solar_altitude_column(self, small_dataset):
        dataset_dir, _ = small_dataset
        df = load_labels_csv(dataset_dir)
        out = add_solar_altitude(df)
        assert SOLAR_FEATURE_COLUMN in out.columns
        assert out[SOLAR_FEATURE_COLUMN].notna().all()
        # 주간 촬영(08~15시 KST) 데이터이므로 전부 지평선 위
        assert (out[SOLAR_FEATURE_COLUMN] > 0).all()
        # 원본은 변경하지 않는다
        assert SOLAR_FEATURE_COLUMN not in df.columns

    def test_add_solar_altitude_requires_location(self, small_dataset):
        dataset_dir, _ = small_dataset
        df = load_labels_csv(dataset_dir).drop(columns=["latitude", "longitude"])
        with pytest.raises(ValueError, match="위경도"):
            add_solar_altitude(df)

    def test_env_scaler_roundtrip_with_solar(self, small_dataset, tmp_path):
        dataset_dir, _ = small_dataset
        df = add_solar_altitude(load_labels_csv(dataset_dir))
        columns = ENV_FEATURE_COLUMNS + [SOLAR_FEATURE_COLUMN]
        scaler = EnvScaler.fit(df, columns=columns)
        assert scaler.columns == columns
        assert scaler.mean.shape == (4,)

        path = tmp_path / "scaler.json"
        scaler.save(path)
        loaded = EnvScaler.load(path)
        assert loaded.columns == columns
        env = loaded.transform(df.iloc[0])
        assert env.shape == (4,)

    def test_env_scaler_load_without_columns_defaults_to_3(self, tmp_path):
        # 태양고도 도입 이전에 저장된 scaler.json 하위 호환
        path = tmp_path / "scaler.json"
        path.write_text('{"mean": [1, 2, 3], "std": [1, 1, 1]}', encoding="utf-8")
        loaded = EnvScaler.load(path)
        assert loaded.columns == ENV_FEATURE_COLUMNS
