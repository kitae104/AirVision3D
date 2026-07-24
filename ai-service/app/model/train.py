"""학습 파이프라인.

labels.csv → 날짜 단위 분리 → 학습 → 검증 → 테스트 평가 → 모델 디렉터리 저장.

모델 디렉터리 구조 (<models_dir>/<model_name>/):
    model.pt      # state_dict
    config.json   # 아키텍처·전처리·학습 설정 (재현/추론용)
    scaler.json   # 환경데이터 정규화 파라미터 (train으로만 fit)
    history.json  # epoch별 train_loss / val_mae
    metrics.json  # 테스트 세트 회귀+등급 지표
"""

import json
import random
import time
from pathlib import Path

import numpy as np
import torch
from torch import nn
from torch.utils.data import DataLoader

from app.data.dataset import AirQualityDataset, EnvScaler
from app.data.schema import (
    ENV_FEATURE_COLUMNS,
    SOLAR_FEATURE_COLUMN,
    add_solar_altitude,
    load_labels_csv,
)
from app.data.split import split_by_date
from app.model.grades import load_grade_scale
from app.model.metrics import full_metrics
from app.model.network import MultimodalPm25Net
from app.preprocessing.image_ops import Roi


def _set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)


@torch.no_grad()
def _collect_predictions(model: nn.Module, loader: DataLoader,
                         device: torch.device) -> tuple[np.ndarray, np.ndarray]:
    model.eval()
    trues, preds = [], []
    for images, envs, targets in loader:
        output = model(images.to(device), envs.to(device))
        preds.append(output.cpu().numpy())
        trues.append(targets.numpy())
    return np.concatenate(trues).ravel(), np.concatenate(preds).ravel()


def train_model(
        dataset_dir: str | Path,
        models_dir: str | Path,
        model_name: str = "resnet18_multimodal_v1",
        epochs: int = 5,
        batch_size: int = 8,
        learning_rate: float = 1e-3,
        pretrained: bool = False,
        backbone: str = "resnet18",
        image_size: int = 224,
        roi: Roi | None = None,
        apply_mad_correction: bool = False,
        use_solar_altitude: bool = False,
        seed: int = 42,
        grades_config_path: str = "config/grades.json",
) -> dict:
    """학습을 수행하고 모델 디렉터리를 생성한다. 요약(dict)을 반환한다."""
    _set_seed(seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    dataset_dir = Path(dataset_dir)
    out_dir = Path(models_dir) / model_name
    out_dir.mkdir(parents=True, exist_ok=True)

    # 데이터 준비 (날짜 단위 분리, scaler는 train으로만 fit)
    df = load_labels_csv(dataset_dir)
    env_columns = list(ENV_FEATURE_COLUMNS)
    if use_solar_altitude:
        df = add_solar_altitude(df)  # 위경도 컬럼 필요 (없으면 ValueError)
        env_columns.append(SOLAR_FEATURE_COLUMN)
    split = split_by_date(df, seed=seed)
    scaler = EnvScaler.fit(split["train"], columns=env_columns)

    def make_loader(part_df, shuffle):
        dataset = AirQualityDataset(
            part_df, dataset_dir, scaler, roi=roi,
            apply_mad_correction=apply_mad_correction, image_size=image_size)
        return DataLoader(dataset, batch_size=batch_size, shuffle=shuffle)

    train_loader = make_loader(split["train"], shuffle=True)
    val_loader = make_loader(split["val"], shuffle=False)
    test_loader = make_loader(split["test"], shuffle=False)

    model = MultimodalPm25Net(pretrained=pretrained, env_dim=len(env_columns),
                              backbone=backbone).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=learning_rate)
    criterion = nn.SmoothL1Loss()

    history = []
    started = time.time()
    for epoch in range(1, epochs + 1):
        model.train()
        epoch_loss, n_batches = 0.0, 0
        for images, envs, targets in train_loader:
            optimizer.zero_grad()
            output = model(images.to(device), envs.to(device))
            loss = criterion(output, targets.to(device))
            loss.backward()
            optimizer.step()
            epoch_loss += float(loss.item())
            n_batches += 1

        val_true, val_pred = _collect_predictions(model, val_loader, device)
        val_mae = float(np.mean(np.abs(val_pred - val_true)))
        history.append({
            "epoch": epoch,
            "train_loss": round(epoch_loss / max(n_batches, 1), 4),
            "val_mae": round(val_mae, 4),
        })
        print(f"[epoch {epoch}/{epochs}] train_loss={history[-1]['train_loss']} "
              f"val_mae={history[-1]['val_mae']}")

    # 테스트 평가 (회귀 + 등급)
    scale = load_grade_scale(grades_config_path)
    test_true, test_pred = _collect_predictions(model, test_loader, device)
    metrics = full_metrics(test_true, np.maximum(test_pred, 0.0), scale)

    # 저장
    config = {
        "model_name": model_name,
        "architecture": f"{backbone}_multimodal",
        "backbone": backbone,
        "pretrained": pretrained,
        "image_size": image_size,
        "roi": roi.__dict__ if roi else None,
        "apply_mad_correction": apply_mad_correction,
        "use_solar_altitude": use_solar_altitude,
        "env_columns": env_columns,
        "epochs": epochs,
        "batch_size": batch_size,
        "learning_rate": learning_rate,
        "seed": seed,
        "dataset_dir": str(dataset_dir),
        "split_sizes": {k: len(v) for k, v in split.items()},
        "trained_seconds": round(time.time() - started, 1),
    }
    torch.save(model.state_dict(), out_dir / "model.pt")
    (out_dir / "config.json").write_text(
        json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8")
    scaler.save(out_dir / "scaler.json")
    (out_dir / "history.json").write_text(
        json.dumps(history, ensure_ascii=False, indent=2), encoding="utf-8")
    (out_dir / "metrics.json").write_text(
        json.dumps(metrics, ensure_ascii=False, indent=2), encoding="utf-8")

    return {"model_dir": str(out_dir), "config": config,
            "history": history, "metrics": metrics}
