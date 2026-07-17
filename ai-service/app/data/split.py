"""학습/검증/테스트 분리 (데이터 누수 방지).

연속 촬영 이미지가 학습과 테스트에 섞이지 않도록
행 단위 무작위 분리가 아닌 **날짜 단위** 분리를 사용한다.
같은 날짜의 모든 데이터는 반드시 같은 세트에 속한다.
"""

import numpy as np
import pandas as pd

SplitResult = dict[str, pd.DataFrame]  # keys: train / val / test


def split_by_date(
        df: pd.DataFrame,
        train_ratio: float = 0.7,
        val_ratio: float = 0.15,
        seed: int = 42,
) -> SplitResult:
    """captured_at의 날짜 단위로 train/val/test를 분리한다.

    - 날짜 목록을 시드 고정 셔플 후 비율대로 배분한다.
    - 날짜 수가 3개 미만이면 ValueError (세트별 최소 1개 날짜 보장 불가).
    """
    if not 0 < train_ratio < 1 or not 0 < val_ratio < 1 or train_ratio + val_ratio >= 1:
        raise ValueError("비율이 올바르지 않습니다 (train + val < 1, 각각 0보다 커야 함)")

    dates = np.array(sorted(df["captured_at"].dt.normalize().unique()))
    if len(dates) < 3:
        raise ValueError(f"날짜 단위 분리에는 최소 3개 날짜가 필요합니다 (현재 {len(dates)}개)")

    rng = np.random.default_rng(seed)
    shuffled = dates.copy()
    rng.shuffle(shuffled)

    n_train = max(1, round(len(shuffled) * train_ratio))
    n_val = max(1, round(len(shuffled) * val_ratio))
    # test에 최소 1개 날짜 보장
    if n_train + n_val >= len(shuffled):
        n_train = len(shuffled) - n_val - 1

    train_dates = set(shuffled[:n_train])
    val_dates = set(shuffled[n_train:n_train + n_val])
    test_dates = set(shuffled[n_train + n_val:])

    day = df["captured_at"].dt.normalize()
    result = {
        "train": df[day.isin(train_dates)].reset_index(drop=True),
        "val": df[day.isin(val_dates)].reset_index(drop=True),
        "test": df[day.isin(test_dates)].reset_index(drop=True),
    }
    assert_no_leakage(result)
    return result


def assert_no_leakage(split: SplitResult) -> None:
    """세트 간 날짜가 겹치지 않음을 검증한다 (누수 방지 게이트)."""
    date_sets = {
        name: set(part["captured_at"].dt.normalize().unique())
        for name, part in split.items()
    }
    names = list(date_sets)
    for i, a in enumerate(names):
        for b in names[i + 1:]:
            overlap = date_sets[a] & date_sets[b]
            if overlap:
                raise AssertionError(
                    f"데이터 누수: {a}/{b} 세트에 같은 날짜가 있습니다: {sorted(overlap)[:3]}")
