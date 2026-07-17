"""labels.csv 스키마 / EnvScaler / Dataset / DataLoader 테스트."""

import numpy as np
import pytest
import torch
from torch.utils.data import DataLoader

from app.data.dataset import AirQualityDataset, EnvScaler
from app.data.schema import load_labels_csv
from app.data.split import split_by_date
from app.preprocessing.image_ops import Roi


def test_load_labels_csv_valid(small_dataset):
    out_dir, generated = small_dataset
    df = load_labels_csv(out_dir)
    assert len(df) == len(generated)
    assert str(df["captured_at"].dtype).startswith("datetime64")


def test_load_labels_csv_missing_file(tmp_path):
    with pytest.raises(FileNotFoundError):
        load_labels_csv(tmp_path)


def test_env_scaler_roundtrip(small_dataset, tmp_path):
    out_dir, _ = small_dataset
    df = load_labels_csv(out_dir)
    scaler = EnvScaler.fit(df)
    path = tmp_path / "scaler.json"
    scaler.save(path)
    loaded = EnvScaler.load(path)
    assert np.allclose(scaler.mean, loaded.mean)
    assert np.allclose(scaler.std, loaded.std)


def test_env_scaler_standardizes_train_set(small_dataset):
    out_dir, _ = small_dataset
    df = load_labels_csv(out_dir)
    scaler = EnvScaler.fit(df)
    transformed = np.stack([scaler.transform(row) for _, row in df.iterrows()])
    # fit한 데이터 전체를 변환하면 평균≈0, 표준편차≈1
    assert np.allclose(transformed.mean(axis=0), 0.0, atol=1e-6)
    assert np.allclose(transformed.std(axis=0), 1.0, atol=1e-6)


def test_dataset_item_shapes(small_dataset):
    out_dir, _ = small_dataset
    df = load_labels_csv(out_dir)
    dataset = AirQualityDataset(df, out_dir, EnvScaler.fit(df), image_size=64)
    image, env, target = dataset[0]
    assert image.shape == (3, 64, 64)
    assert env.shape == (3,)
    assert target.shape == (1,)
    assert image.dtype == torch.float32


def test_dataset_with_roi_and_mad(small_dataset):
    out_dir, _ = small_dataset
    df = load_labels_csv(out_dir)
    dataset = AirQualityDataset(
        df, out_dir, EnvScaler.fit(df),
        roi=Roi(x=4, y=4, width=48, height=32),
        apply_mad_correction=True, image_size=64)
    image, _, _ = dataset[0]
    assert image.shape == (3, 64, 64)


def test_dataloader_end_to_end_with_split(small_dataset):
    """완료 조건: 샘플 이미지+CSV → 날짜 분리 → DataLoader 배치 순회."""
    out_dir, _ = small_dataset
    df = load_labels_csv(out_dir)
    split = split_by_date(df, seed=3)

    scaler = EnvScaler.fit(split["train"])  # train으로만 fit (누수 방지)
    train_ds = AirQualityDataset(split["train"], out_dir, scaler, image_size=64)
    loader = DataLoader(train_ds, batch_size=4, shuffle=True)

    images, envs, targets = next(iter(loader))
    assert images.shape[1:] == (3, 64, 64)
    assert envs.shape[1] == 3
    assert targets.shape[1] == 1
    assert images.shape[0] == envs.shape[0] == targets.shape[0]
