"""모델 학습 CLI.

사용법 (ai-service 디렉터리에서):
    .venv\\Scripts\\python scripts/train_model.py [--epochs 5] [--pretrained] ...
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.model.train import train_model  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="멀티모달 PM2.5 회귀 모델 학습")
    parser.add_argument("--dataset", default="../data/sample/dataset")
    parser.add_argument("--models-dir", default="../data/models")
    parser.add_argument("--name", default="resnet18_multimodal_v1")
    parser.add_argument("--epochs", type=int, default=5)
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--image-size", type=int, default=224)
    parser.add_argument("--pretrained", action="store_true",
                        help="ImageNet 사전학습 가중치 사용 (최초 실행 시 다운로드)")
    parser.add_argument("--mad", action="store_true", help="MAD 이상치 보정 적용")
    parser.add_argument("--solar", action="store_true",
                        help="태양고도를 4번째 환경 특징으로 사용 (labels.csv에 위경도 필요)")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    summary = train_model(
        dataset_dir=args.dataset, models_dir=args.models_dir, model_name=args.name,
        epochs=args.epochs, batch_size=args.batch_size, learning_rate=args.lr,
        pretrained=args.pretrained, image_size=args.image_size,
        apply_mad_correction=args.mad, use_solar_altitude=args.solar, seed=args.seed)

    print("\n=== 학습 완료 ===")
    print(f"모델 저장 위치: {summary['model_dir']}")
    print("테스트 지표:")
    print(json.dumps(summary["metrics"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
