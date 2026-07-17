"""모델 관리 API: 목록 조회, 성능 조회, 학습 실행, 추론."""

import io
import json
import re
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from PIL import Image
from pydantic import BaseModel, Field

from app.common.response import ApiResponse
from app.core.config import get_settings
from app.model.predict import Predictor
from app.model.train import train_model

router = APIRouter(prefix="/models", tags=["models"])

# 모델명 허용 형식 (경로 조작 방지: 영숫자/언더스코어/하이픈/점, 최대 64자)
_MODEL_NAME_PATTERN = re.compile(r"^[A-Za-z0-9_.-]{1,64}$")

# 추론 시 모델 로드 캐시 (모델명 → Predictor)
_predictor_cache: dict[str, Predictor] = {}


def _models_root() -> Path:
    return Path(get_settings().models_dir)


def _safe_model_dir(model_name: str) -> Path:
    """모델명을 검증하고 models_dir 내부 경로임을 보장한다 (경로 조작 방지)."""
    if not _MODEL_NAME_PATTERN.fullmatch(model_name) or ".." in model_name:
        raise HTTPException(status_code=400,
                            detail="모델명은 영숫자, '_', '-', '.'만 사용할 수 있습니다")
    root = _models_root().resolve()
    model_dir = (root / model_name).resolve()
    if not model_dir.is_relative_to(root):
        raise HTTPException(status_code=400, detail="허용되지 않는 모델 경로입니다")
    return model_dir


def _load_predictor(model_name: str) -> Predictor:
    if model_name not in _predictor_cache:
        model_dir = _safe_model_dir(model_name)
        if not model_dir.exists():
            raise HTTPException(status_code=404,
                                detail=f"모델을 찾을 수 없습니다: {model_name}")
        _predictor_cache[model_name] = Predictor.load(
            model_dir, get_settings().grades_config_path)
    return _predictor_cache[model_name]


@router.get("")
def list_models() -> ApiResponse:
    """저장된 모델 목록과 요약 정보."""
    root = _models_root()
    models = []
    if root.exists():
        for model_dir in sorted(root.iterdir()):
            config_path = model_dir / "config.json"
            if not config_path.exists():
                continue
            config = json.loads(config_path.read_text(encoding="utf-8"))
            models.append({
                "model_name": config.get("model_name", model_dir.name),
                "architecture": config.get("architecture"),
                "pretrained": config.get("pretrained"),
                "image_size": config.get("image_size"),
                "epochs": config.get("epochs"),
            })
    return ApiResponse.ok(models)


@router.get("/{model_name}/metrics")
def model_metrics(model_name: str) -> ApiResponse:
    """모델의 테스트 성능지표 (회귀 + 등급 분류)."""
    metrics_path = _safe_model_dir(model_name) / "metrics.json"
    if not metrics_path.exists():
        raise HTTPException(status_code=404,
                            detail=f"성능지표가 없습니다: {model_name}")
    return ApiResponse.ok(json.loads(metrics_path.read_text(encoding="utf-8")))


class TrainRequest(BaseModel):
    model_name: str = "resnet18_multimodal_v1"
    dataset_dir: str | None = None
    epochs: int = Field(default=3, ge=1, le=100)
    batch_size: int = Field(default=8, ge=1, le=128)
    learning_rate: float = Field(default=1e-3, gt=0)
    pretrained: bool = False
    image_size: int = Field(default=224, ge=64, le=512)
    apply_mad_correction: bool = False
    seed: int = 42


@router.post("/train")
def train(request: TrainRequest) -> ApiResponse:
    """학습 실행 (동기 처리 — 샘플 데이터 기준 수 분 이내).

    MVP에서는 요청이 완료될 때까지 블로킹된다. 대규모 데이터 학습은
    scripts/train_model.py CLI 사용을 권장한다.
    """
    settings = get_settings()
    _safe_model_dir(request.model_name)  # 모델명 검증 (경로 조작 방지)
    dataset_dir = Path(request.dataset_dir or settings.default_dataset_dir)
    # 데이터셋은 data_dir 내부 경로만 허용 (경로 조작 방지)
    data_root = Path(settings.data_dir).resolve()
    if not dataset_dir.resolve().is_relative_to(data_root):
        raise HTTPException(status_code=400,
                            detail="데이터셋은 data 디렉터리 내부 경로만 허용됩니다")
    if not dataset_dir.exists():
        raise HTTPException(status_code=400,
                            detail=f"데이터셋 디렉터리가 없습니다: {dataset_dir}")
    try:
        summary = train_model(
            dataset_dir=dataset_dir, models_dir=settings.models_dir,
            model_name=request.model_name, epochs=request.epochs,
            batch_size=request.batch_size, learning_rate=request.learning_rate,
            pretrained=request.pretrained, image_size=request.image_size,
            apply_mad_correction=request.apply_mad_correction, seed=request.seed,
            grades_config_path=settings.grades_config_path)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    # 재학습된 모델은 캐시 무효화
    _predictor_cache.pop(request.model_name, None)
    return ApiResponse.ok({
        "model_dir": summary["model_dir"],
        "history": summary["history"],
        "metrics": summary["metrics"],
    })


@router.post("/{model_name}/predict")
async def predict(
        model_name: str,
        image: UploadFile = File(..., description="대기 이미지"),
        temperature: float = Form(...),
        humidity: float = Form(..., ge=0, le=100),
        wind_speed: float = Form(..., ge=0),
) -> ApiResponse:
    """이미지 + 환경데이터로 PM2.5를 예측한다."""
    predictor = _load_predictor(model_name)
    try:
        pil_image = Image.open(io.BytesIO(await image.read()))
    except Exception:
        raise HTTPException(status_code=400, detail="이미지 파일을 해석할 수 없습니다")
    result = predictor.predict(pil_image, temperature, humidity, wind_speed)
    return ApiResponse.ok({**result, "model_name": model_name})
