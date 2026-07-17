"""날짜 단위 데이터 분리(누수 방지) 테스트."""

import pandas as pd
import pytest

from app.data.split import assert_no_leakage, split_by_date


def _df_with_days(n_days: int, rows_per_day: int = 4) -> pd.DataFrame:
    rows = []
    for d in range(n_days):
        for h in range(rows_per_day):
            rows.append({
                "captured_at": pd.Timestamp("2026-07-01") + pd.Timedelta(days=d, hours=h),
                "pm25": 20.0 + d,
            })
    return pd.DataFrame(rows)


def test_split_no_date_overlap():
    split = split_by_date(_df_with_days(10))
    assert_no_leakage(split)  # 예외 없어야 함


def test_split_all_rows_preserved():
    df = _df_with_days(10)
    split = split_by_date(df)
    total = sum(len(part) for part in split.values())
    assert total == len(df)


def test_split_each_set_nonempty():
    split = split_by_date(_df_with_days(5))
    for name, part in split.items():
        assert len(part) > 0, f"{name} 세트가 비어 있음"


def test_split_same_day_rows_stay_together():
    split = split_by_date(_df_with_days(6))
    for part in split.values():
        # 각 세트의 날짜별 행 수는 rows_per_day(4)의 배수여야 한다
        counts = part["captured_at"].dt.normalize().value_counts()
        assert (counts == 4).all()


def test_split_deterministic_with_seed():
    df = _df_with_days(8)
    a = split_by_date(df, seed=1)
    b = split_by_date(df, seed=1)
    for name in a:
        pd.testing.assert_frame_equal(a[name], b[name])


def test_split_too_few_days_raises():
    with pytest.raises(ValueError):
        split_by_date(_df_with_days(2))


def test_assert_no_leakage_detects_overlap():
    df = _df_with_days(4)
    leaky = {"train": df, "val": df.head(4), "test": df.tail(4)}
    with pytest.raises(AssertionError):
        assert_no_leakage(leaky)
