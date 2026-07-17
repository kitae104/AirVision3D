"""이미지 전처리 연산 모듈.

- 로드 / 리사이즈 / 정규화
- ROI(관심영역) 추출: 설정값 (x, y, width, height) 기반
- MAD(Median Absolute Deviation) 기반 픽셀 이상치 확인·보정
"""

from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image

# ImageNet 사전학습 모델 표준 정규화 상수
IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)

# 정규분포 가정 시 MAD를 표준편차 스케일로 환산하는 상수
MAD_SCALE = 1.4826


@dataclass(frozen=True)
class Roi:
    """관심영역 사각형. 설정 파일 또는 요청 파라미터로 지정한다."""

    x: int
    y: int
    width: int
    height: int

    def validate_within(self, image_width: int, image_height: int) -> None:
        if self.x < 0 or self.y < 0 or self.width <= 0 or self.height <= 0:
            raise ValueError(f"ROI 좌표가 올바르지 않습니다: {self}")
        if self.x + self.width > image_width or self.y + self.height > image_height:
            raise ValueError(
                f"ROI가 이미지 범위를 벗어납니다: {self}, 이미지 크기=({image_width}x{image_height})")


def load_image(path: str | Path) -> Image.Image:
    """이미지를 RGB로 로드한다."""
    image = Image.open(path)
    return image.convert("RGB")


def resize_image(image: Image.Image, size: tuple[int, int] = (224, 224)) -> Image.Image:
    """(width, height) 크기로 리사이즈한다."""
    return image.resize(size, Image.Resampling.BILINEAR)


def crop_roi(image: Image.Image, roi: Roi) -> Image.Image:
    """ROI 영역을 잘라낸다. ROI가 이미지 범위를 벗어나면 ValueError."""
    roi.validate_within(image.width, image.height)
    return image.crop((roi.x, roi.y, roi.x + roi.width, roi.y + roi.height))


def to_float_array(image: Image.Image) -> np.ndarray:
    """(H, W, 3) float32 [0, 1] 배열로 변환한다."""
    return np.asarray(image, dtype=np.float32) / 255.0


def normalize_imagenet(array: np.ndarray) -> np.ndarray:
    """[0,1] 배열을 ImageNet mean/std로 표준화한다."""
    return (array - IMAGENET_MEAN) / IMAGENET_STD


def brightness_stats(array: np.ndarray) -> dict[str, float]:
    """밝기(그레이스케일) 통계: mean / median / mad. 이상치 확인용."""
    gray = array.mean(axis=-1)
    median = float(np.median(gray))
    mad = float(np.median(np.abs(gray - median)))
    return {"mean": float(gray.mean()), "median": median, "mad": mad}


def correct_outliers_mad(array: np.ndarray, k: float = 3.5) -> tuple[np.ndarray, int]:
    """MAD 기반 픽셀 이상치 보정.

    밝기가 median ± k * 1.4826 * MAD 범위를 벗어나는 픽셀을
    경계값으로 클리핑한다(전 채널 동일 비율 적용).

    Returns:
        (보정된 배열, 이상치로 판정된 픽셀 수)
    """
    gray = array.mean(axis=-1)
    median = float(np.median(gray))
    mad = float(np.median(np.abs(gray - median)))
    if mad == 0.0:
        # 균일 이미지: 보정할 수 없으므로 원본 반환
        return array.copy(), 0

    lower = median - k * MAD_SCALE * mad
    upper = median + k * MAD_SCALE * mad
    outlier_mask = (gray < lower) | (gray > upper)

    corrected = array.copy()
    # 이상치 픽셀의 밝기를 경계값으로 맞추도록 채널 비율 스케일링
    target = np.clip(gray, lower, upper)
    scale = np.where(gray > 0, target / np.maximum(gray, 1e-8), 1.0)
    corrected[outlier_mask] = np.clip(
        corrected[outlier_mask] * scale[outlier_mask, None], 0.0, 1.0)
    return corrected, int(outlier_mask.sum())


def preprocess_for_model(
        path: str | Path,
        roi: Roi | None = None,
        apply_mad_correction: bool = False,
        image_size: int = 224,
) -> np.ndarray:
    """모델 입력용 전처리 파이프라인.

    로드 → (ROI 추출) → 리사이즈 → [0,1] → (MAD 보정) → ImageNet 정규화
    Returns: (3, H, W) float32 배열 (CHW, PyTorch 텐서 변환 직전 형태)
    """
    image = load_image(path)
    if roi is not None:
        image = crop_roi(image, roi)
    image = resize_image(image, (image_size, image_size))
    array = to_float_array(image)
    if apply_mad_correction:
        array, _ = correct_outliers_mad(array)
    array = normalize_imagenet(array)
    return np.transpose(array, (2, 0, 1)).astype(np.float32)
