"""이미지 전처리 연산 테스트."""

import numpy as np
import pytest
from PIL import Image

from app.preprocessing.image_ops import (
    Roi,
    brightness_stats,
    correct_outliers_mad,
    crop_roi,
    normalize_imagenet,
    preprocess_for_model,
    resize_image,
    to_float_array,
)


def _solid_image(w=100, h=80, color=(120, 130, 140)) -> Image.Image:
    return Image.new("RGB", (w, h), color)


def test_resize_changes_dimensions():
    resized = resize_image(_solid_image(), (224, 224))
    assert resized.size == (224, 224)


def test_crop_roi_returns_requested_region():
    cropped = crop_roi(_solid_image(100, 80), Roi(x=10, y=20, width=30, height=40))
    assert cropped.size == (30, 40)


def test_crop_roi_out_of_bounds_raises():
    with pytest.raises(ValueError):
        crop_roi(_solid_image(100, 80), Roi(x=90, y=0, width=30, height=40))


def test_crop_roi_negative_raises():
    with pytest.raises(ValueError):
        crop_roi(_solid_image(), Roi(x=-1, y=0, width=10, height=10))


def test_to_float_array_range():
    arr = to_float_array(_solid_image())
    assert arr.dtype == np.float32
    assert arr.min() >= 0.0 and arr.max() <= 1.0


def test_normalize_imagenet_zero_centers():
    # ImageNet mean과 동일한 픽셀값은 정규화 후 0이 되어야 한다
    arr = np.tile(np.array([0.485, 0.456, 0.406], dtype=np.float32), (4, 4, 1))
    normalized = normalize_imagenet(arr)
    assert np.allclose(normalized, 0.0, atol=1e-6)


def test_mad_correction_reduces_outliers():
    # 균일 배경에 극단적으로 밝은 픽셀(이상치)을 심는다
    arr = np.full((50, 50, 3), 0.5, dtype=np.float32)
    arr += np.random.default_rng(0).normal(0, 0.01, arr.shape).astype(np.float32)
    arr[0:3, 0:3, :] = 1.0  # 9개 이상치
    corrected, n_outliers = correct_outliers_mad(arr, k=3.5)
    assert n_outliers >= 9
    # 보정 후 이상치 영역 밝기가 낮아져야 한다
    assert corrected[0:3, 0:3].mean() < arr[0:3, 0:3].mean()


def test_mad_correction_uniform_image_is_noop():
    arr = np.full((20, 20, 3), 0.5, dtype=np.float32)
    corrected, n_outliers = correct_outliers_mad(arr)
    assert n_outliers == 0
    assert np.array_equal(corrected, arr)


def test_brightness_stats_keys():
    stats = brightness_stats(to_float_array(_solid_image()))
    assert set(stats) == {"mean", "median", "mad"}


def test_preprocess_for_model_shape(tmp_path):
    path = tmp_path / "img.png"
    _solid_image(320, 240).save(path)
    out = preprocess_for_model(path, roi=Roi(10, 10, 200, 150), image_size=224)
    assert out.shape == (3, 224, 224)
    assert out.dtype == np.float32
