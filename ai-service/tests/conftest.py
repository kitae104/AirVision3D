"""공용 테스트 픽스처: 소형 합성 데이터셋."""

import pytest

from app.sample.generator import generate_sample_dataset


@pytest.fixture(scope="session")
def small_dataset(tmp_path_factory):
    """2개 관측소 × 4일 × 3장 (총 24장, 64x48px) 소형 데이터셋."""
    out_dir = tmp_path_factory.mktemp("dataset")
    df = generate_sample_dataset(
        out_dir, n_sites=2, n_days=4, hours_per_day=3,
        image_size=(64, 48), seed=7)
    return out_dir, df
