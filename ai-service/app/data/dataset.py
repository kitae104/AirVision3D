"""PyTorch Dataset / 환경데이터 정규화.

이미지(전처리 파이프라인)와 환경데이터(온도·습도·풍속)를 함께 반환하는
멀티모달 회귀용 Dataset. 타깃은 PM2.5 실측값이다.
"""

import json
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from torch.utils.data import Dataset

from app.data.schema import ENV_FEATURE_COLUMNS, TARGET_COLUMN
from app.preprocessing.image_ops import Roi, preprocess_for_model


@dataclass
class EnvScaler:
    """환경데이터 표준화(z-score). 학습(train) 세트로만 fit해야 한다 (누수 방지).

    columns가 특징 구성을 결정한다 (기본 3특징, 태양고도 포함 시 4특징).
    """

    mean: np.ndarray
    std: np.ndarray
    columns: list[str] = field(default_factory=lambda: list(ENV_FEATURE_COLUMNS))

    @classmethod
    def fit(cls, df: pd.DataFrame, columns: list[str] | None = None) -> "EnvScaler":
        cols = list(columns) if columns else list(ENV_FEATURE_COLUMNS)
        values = df[cols].to_numpy(dtype=np.float64)
        std = values.std(axis=0)
        # 분산 0인 특징은 나눗셈 오류 방지
        std = np.where(std < 1e-12, 1.0, std)
        return cls(mean=values.mean(axis=0), std=std, columns=cols)

    def transform(self, row: pd.Series) -> np.ndarray:
        values = row[self.columns].to_numpy(dtype=np.float64)
        return ((values - self.mean) / self.std).astype(np.float32)

    def save(self, path: str | Path) -> None:
        Path(path).write_text(json.dumps({
            "columns": self.columns,
            "mean": self.mean.tolist(),
            "std": self.std.tolist(),
        }), encoding="utf-8")

    @classmethod
    def load(cls, path: str | Path) -> "EnvScaler":
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        return cls(mean=np.array(data["mean"]), std=np.array(data["std"]),
                   columns=list(data.get("columns", ENV_FEATURE_COLUMNS)))


class AirQualityDataset(Dataset):
    """대기 이미지 + 환경데이터 → PM2.5 회귀용 Dataset.

    __getitem__ 반환: (image_tensor(3,S,S), env_tensor(len(scaler.columns),), target_tensor(1,))
    """

    def __init__(
            self,
            df: pd.DataFrame,
            dataset_dir: str | Path,
            env_scaler: EnvScaler,
            roi: Roi | None = None,
            apply_mad_correction: bool = False,
            image_size: int = 224,
    ):
        self.df = df.reset_index(drop=True)
        self.dataset_dir = Path(dataset_dir)
        self.env_scaler = env_scaler
        self.roi = roi
        self.apply_mad_correction = apply_mad_correction
        self.image_size = image_size

    def __len__(self) -> int:
        return len(self.df)

    def __getitem__(self, index: int):
        row = self.df.iloc[index]
        image = preprocess_for_model(
            self.dataset_dir / row["image_path"],
            roi=self.roi,
            apply_mad_correction=self.apply_mad_correction,
            image_size=self.image_size,
        )
        env = self.env_scaler.transform(row)
        target = np.array([row[TARGET_COLUMN]], dtype=np.float32)
        return (
            torch.from_numpy(image),
            torch.from_numpy(env),
            torch.from_numpy(target),
        )
