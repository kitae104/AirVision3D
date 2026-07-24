"""저장된 모델 로드와 추론."""

import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import torch
from PIL import Image

from app.common.solar import solar_elevation_deg
from app.data.dataset import EnvScaler
from app.data.schema import SOLAR_FEATURE_COLUMN
from app.model.grades import GradeScale, load_grade_scale
from app.model.network import MultimodalPm25Net
from app.preprocessing.image_ops import (
    Roi,
    correct_outliers_mad,
    normalize_imagenet,
    resize_image,
    to_float_array,
)


class Predictor:
    """모델 디렉터리(model.pt/config.json/scaler.json)에서 로드해 추론한다."""

    def __init__(self, model: MultimodalPm25Net, scaler: EnvScaler,
                 config: dict, scale: GradeScale):
        self.model = model
        self.scaler = scaler
        self.config = config
        self.scale = scale

    @property
    def uses_solar_altitude(self) -> bool:
        return SOLAR_FEATURE_COLUMN in self.scaler.columns

    @classmethod
    def load(cls, model_dir: str | Path,
             grades_config_path: str = "config/grades.json") -> "Predictor":
        model_dir = Path(model_dir)
        if not (model_dir / "model.pt").exists():
            raise FileNotFoundError(f"모델 파일이 없습니다: {model_dir / 'model.pt'}")
        config = json.loads((model_dir / "config.json").read_text(encoding="utf-8"))
        scaler = EnvScaler.load(model_dir / "scaler.json")
        # backbone 미기록(구버전 모델)은 resnet18로 간주한다
        model = MultimodalPm25Net(pretrained=False, env_dim=len(scaler.columns),
                                  backbone=config.get("backbone", "resnet18"))
        model.load_state_dict(torch.load(model_dir / "model.pt",
                                         map_location="cpu", weights_only=True))
        model.eval()
        return cls(model, scaler, config, load_grade_scale(grades_config_path))

    @torch.no_grad()
    def predict(self, image: Image.Image, temperature: float,
                humidity: float, wind_speed: float,
                latitude: float | None = None,
                longitude: float | None = None,
                captured_at: datetime | None = None) -> dict:
        """PIL 이미지 + 환경값 → {"pm25": float, "grade": str}.

        태양고도를 사용하는 모델은 latitude/longitude가 필수이며,
        captured_at 생략 시 현재 시각(UTC)으로 계산한다.
        """
        array = self._preprocess(image)
        values = {
            "temperature": temperature,
            "humidity": humidity,
            "wind_speed": wind_speed,
        }
        if self.uses_solar_altitude:
            if latitude is None or longitude is None:
                raise ValueError(
                    "이 모델은 태양고도 입력을 사용합니다: latitude/longitude를 함께 보내세요")
            when = captured_at or datetime.now(timezone.utc)
            values[SOLAR_FEATURE_COLUMN] = solar_elevation_deg(latitude, longitude, when)

        env_raw = np.array([values[c] for c in self.scaler.columns], dtype=np.float64)
        env = ((env_raw - self.scaler.mean) / self.scaler.std).astype(np.float32)

        output = self.model(
            torch.from_numpy(array).unsqueeze(0),
            torch.from_numpy(env).unsqueeze(0))
        pm25 = max(0.0, float(output.item()))
        return {"pm25": round(pm25, 2), "grade": self.scale.grade_of(pm25)}

    def _preprocess(self, image: Image.Image) -> np.ndarray:
        """학습 시 config와 동일한 전처리를 적용한다."""
        image = image.convert("RGB")
        roi_cfg = self.config.get("roi")
        if roi_cfg:
            from app.preprocessing.image_ops import crop_roi
            image = crop_roi(image, Roi(**roi_cfg))
        image = resize_image(image, (self.config["image_size"], self.config["image_size"]))
        array = to_float_array(image)
        if self.config.get("apply_mad_correction"):
            array, _ = correct_outliers_mad(array)
        array = normalize_imagenet(array)
        return np.transpose(array, (2, 0, 1)).astype(np.float32)
