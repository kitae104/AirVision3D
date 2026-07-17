"""샘플 데이터셋 생성 CLI.

사용법 (ai-service 디렉터리에서):
    .venv\\Scripts\\python scripts/generate_sample_dataset.py [--out ../data/sample/dataset]
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.sample.generator import generate_sample_dataset  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="합성 샘플 데이터셋 생성")
    parser.add_argument("--out", default="../data/sample/dataset",
                        help="출력 디렉터리 (기본: ../data/sample/dataset)")
    parser.add_argument("--sites", type=int, default=3)
    parser.add_argument("--days", type=int, default=5)
    parser.add_argument("--hours", type=int, default=8, help="일별 촬영 수 (08시부터)")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    df = generate_sample_dataset(
        args.out, n_sites=args.sites, n_days=args.days,
        hours_per_day=args.hours, seed=args.seed)
    print(f"생성 완료: {len(df)}건 → {Path(args.out).resolve()}")
    print(f"pm25 범위: {df['pm25'].min()} ~ {df['pm25'].max()}")


if __name__ == "__main__":
    main()
