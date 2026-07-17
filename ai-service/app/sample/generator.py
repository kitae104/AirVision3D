"""합성 샘플 데이터셋 생성기.

실제 대기 이미지가 확보되기 전, 파이프라인 검증용으로
'안개 강도가 PM2.5와 상관된' 합성 하늘 이미지를 생성한다.

- 하늘: 상단(하늘색) → 하단(지평선) 수직 그라데이션
- 지면: 하단 어두운 띠 (건물 실루엣 느낌의 사각형 포함)
- 안개: PM2.5가 높을수록 회색 오버레이 알파가 커짐
- 환경값: 시간대별 사인파 + 잡음 (temperature/humidity/wind_speed)

주의: 합성 데이터이므로 모델의 '실데이터 성능'을 대변하지 않는다.
학습 파이프라인이 end-to-end로 동작하는지 검증하는 용도다.
"""

import math
from pathlib import Path

import numpy as np
import pandas as pd
from PIL import Image

from app.data.schema import REQUIRED_COLUMNS


def _render_image(rng: np.random.Generator, pm25: float,
                  width: int, height: int) -> Image.Image:
    """PM2.5에 비례한 안개가 낀 합성 풍경 이미지를 렌더링한다."""
    # 하늘 그라데이션 (위: 파랑 → 아래: 밝은 하늘)
    top = np.array([110, 160, 220], dtype=np.float32)
    horizon = np.array([200, 215, 230], dtype=np.float32)
    rows = np.linspace(0, 1, height, dtype=np.float32)[:, None, None]
    img = top[None, None, :] * (1 - rows) + horizon[None, None, :] * rows
    img = np.repeat(img, width, axis=1)

    # 지면 띠 + 건물 실루엣
    ground_h = height // 5
    img[-ground_h:, :, :] = np.array([70, 75, 70], dtype=np.float32)
    n_buildings = int(rng.integers(3, 7))
    for _ in range(n_buildings):
        bw = int(rng.integers(width // 16, width // 6))
        bh = int(rng.integers(ground_h, height // 2))
        bx = int(rng.integers(0, max(1, width - bw)))
        shade = float(rng.uniform(45, 90))
        img[height - ground_h - bh: height - ground_h, bx: bx + bw, :] = shade

    # 안개 오버레이: PM2.5 0→150 을 알파 0→0.85 로 매핑
    fog_alpha = min(0.85, max(0.0, pm25 / 150.0 * 0.85))
    fog_color = np.array([190, 190, 188], dtype=np.float32)
    img = img * (1 - fog_alpha) + fog_color[None, None, :] * fog_alpha

    # 센서 잡음
    img = img + rng.normal(0, 3.0, img.shape).astype(np.float32)
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), mode="RGB")


def generate_sample_dataset(
        out_dir: str | Path,
        n_sites: int = 3,
        n_days: int = 5,
        hours_per_day: int = 8,
        image_size: tuple[int, int] = (320, 240),
        seed: int = 42,
        start_date: str = "2026-07-01",
) -> pd.DataFrame:
    """합성 데이터셋(images/ + labels.csv)을 생성하고 DataFrame을 반환한다."""
    out_dir = Path(out_dir)
    images_dir = out_dir / "images"
    images_dir.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(seed)

    rows = []
    base = pd.Timestamp(start_date)
    for site_id in range(1, n_sites + 1):
        site_phase = rng.uniform(0, 2 * math.pi)
        for day in range(n_days):
            # 날짜별 기저 오염도 (일 단위 변동)
            day_level = float(rng.uniform(10, 60))
            for hour_idx in range(hours_per_day):
                hour = 8 + hour_idx  # 08시~15시 (주간 촬영 가정)
                ts = base + pd.Timedelta(days=day, hours=hour)
                pm25 = max(2.0, day_level
                           + 12 * math.sin(hour / 24 * 2 * math.pi + site_phase)
                           + float(rng.normal(0, 5)))
                temperature = 22 + 6 * math.sin((hour - 9) / 24 * 2 * math.pi) \
                    + float(rng.normal(0, 1))
                humidity = min(100.0, max(15.0,
                    60 - 15 * math.sin((hour - 9) / 24 * 2 * math.pi)
                    + float(rng.normal(0, 5))))
                wind_speed = max(0.1, 2.0 + float(rng.normal(0, 1)))

                name = f"site{site_id}_{ts.strftime('%Y%m%d_%H')}.png"
                _render_image(rng, pm25, *image_size).save(images_dir / name)
                rows.append({
                    "image_path": f"images/{name}",
                    "site_id": site_id,
                    "captured_at": ts.isoformat(),
                    "temperature": round(temperature, 1),
                    "humidity": round(humidity, 1),
                    "wind_speed": round(wind_speed, 1),
                    "pm25": round(pm25, 1),
                })

    df = pd.DataFrame(rows, columns=REQUIRED_COLUMNS)
    df.to_csv(out_dir / "labels.csv", index=False)
    return df
