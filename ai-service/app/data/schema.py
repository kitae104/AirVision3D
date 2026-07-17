"""학습 데이터셋 CSV(labels.csv) 스키마 정의와 로드/검증.

데이터셋 디렉터리 구조:
    <dataset_dir>/
      labels.csv          # 아래 스키마
      images/
        <image_path>...   # labels.csv의 image_path는 dataset_dir 기준 상대경로

labels.csv 컬럼:
    image_path   : 이미지 상대경로 (예: images/site1_20260701_09.png)
    site_id      : 관측소 ID (정수)
    captured_at  : 촬영 시각 (ISO-8601)
    temperature  : 기온 (°C)
    humidity     : 습도 (%)
    wind_speed   : 풍속 (m/s)
    pm25         : 실측 PM2.5 (μg/m³) - 학습 타깃
"""

from pathlib import Path

import pandas as pd

REQUIRED_COLUMNS = [
    "image_path", "site_id", "captured_at",
    "temperature", "humidity", "wind_speed", "pm25",
]

ENV_FEATURE_COLUMNS = ["temperature", "humidity", "wind_speed"]
TARGET_COLUMN = "pm25"


def load_labels_csv(dataset_dir: str | Path) -> pd.DataFrame:
    """labels.csv를 로드하고 스키마를 검증한다.

    Raises:
        FileNotFoundError: labels.csv가 없을 때
        ValueError: 필수 컬럼 누락, 빈 파일, 결측 타깃 등
    """
    dataset_dir = Path(dataset_dir)
    csv_path = dataset_dir / "labels.csv"
    if not csv_path.exists():
        raise FileNotFoundError(f"labels.csv가 없습니다: {csv_path}")

    df = pd.read_csv(csv_path)
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"필수 컬럼이 없습니다: {missing}")
    if df.empty:
        raise ValueError("labels.csv가 비어 있습니다")

    df["captured_at"] = pd.to_datetime(df["captured_at"])
    if df[TARGET_COLUMN].isna().any():
        raise ValueError("pm25(타깃)에 결측값이 있습니다")
    if (df[TARGET_COLUMN] < 0).any():
        raise ValueError("pm25(타깃)에 음수가 있습니다")

    # 이미지 파일 존재 확인 (조기 실패)
    missing_images = [
        p for p in df["image_path"] if not (dataset_dir / p).exists()
    ]
    if missing_images:
        raise ValueError(f"존재하지 않는 이미지가 {len(missing_images)}건 있습니다 "
                         f"(예: {missing_images[:3]})")
    return df
