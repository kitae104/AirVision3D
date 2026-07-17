# AI 모델 설계서

## 1. 문제 정의

대기 이미지 + 환경데이터(기온·습도·풍속) → **PM2.5 농도 회귀** (연속값 1개).
예측값으로 4등급(좋음/보통/나쁨/매우나쁨)을 계산한다 (등급은 후처리, 분류 모델 아님).

## 2. 모델 구조 (MultimodalPm25Net)

```
이미지 (3×224×224)                       환경데이터 (3,)
     │                                        │ z-score 정규화
ResNet18 backbone (fc 제거)                    │ (EnvScaler, train으로만 fit)
     │ 512차원 특징                            │
     └────────────── concat (515) ────────────┘
                        │
        Linear(515→128) → ReLU → Dropout(0.2)
        Linear(128→64) → ReLU → Linear(64→1)
                        │
                   PM2.5 예측값
```

- ImageNet 사전학습 가중치: `pretrained` 설정으로 선택 (기본 False, 최초 사용 시 다운로드)
- 구현: `ai-service/app/model/network.py`

## 3. 데이터 파이프라인

| 단계 | 내용 | 구현 |
|---|---|---|
| 입력 명세 | labels.csv 7컬럼 (image_path, site_id, captured_at, temperature, humidity, wind_speed, pm25) | app/data/schema.py |
| 전처리 | 로드 → (ROI 크롭) → 리사이즈 → [0,1] → (MAD 보정) → ImageNet 정규화 | app/preprocessing/image_ops.py |
| ROI | 설정값 (x, y, width, height), 범위 검증 | Roi dataclass |
| 이상치 보정 | 밝기 median ± 3.5×1.4826×MAD 클리핑 | correct_outliers_mad |
| 분할 | **날짜 단위** train/val/test (기본 0.7/0.15/0.15, 시드 고정) — 연속 촬영 누수 방지 | app/data/split.py |
| 누수 게이트 | 세트 간 날짜 중복 시 AssertionError | assert_no_leakage |
| Dataset | (이미지 텐서, 환경 텐서, 타깃) 반환 | app/data/dataset.py |

## 4. 학습 설정

| 항목 | 값 |
|---|---|
| 손실 함수 | SmoothL1Loss |
| 옵티마이저 | Adam (lr 1e-3 기본) |
| 배치/에폭 | 8 / 5 (샘플 기준, CLI로 조정) |
| 장치 | CPU 보장 (CUDA 있으면 자동 사용) |
| 재현성 | random/numpy/torch 시드 고정 |
| 실행 | `scripts/train_model.py` 또는 POST /models/train |

## 5. 모델 저장 형식 (`data/models/<model_name>/`)

| 파일 | 내용 |
|---|---|
| model.pt | state_dict (로드 시 weights_only=True) |
| config.json | 아키텍처·전처리·학습 설정 (추론 시 동일 전처리 재현) |
| scaler.json | 환경데이터 정규화 파라미터 |
| history.json | epoch별 train_loss / val_mae |
| metrics.json | 테스트 세트 지표 |

## 6. 평가 지표 (회귀와 분류를 구분)

- **회귀**: MAE, RMSE, MAPE(실측 하한 1.0 적용), R²
- **등급 분류**: 4등급 정확도, 혼동행렬 (행=실제, 열=예측)
- 등급 기준: `config/grades.json` (한국 환경부 기준)

## 7. 현재 결과와 한계

- 합성 샘플 120장, 5 epochs, 스크래치 학습(파이프라인 검증 목적):
  MAE 11.90 / RMSE 12.11 / MAPE 30.8% / R² -0.84 / 등급 정확도 0.50
- **위 수치는 실데이터 성능이 아니다.** 보고서에는 "시스템 검증"과 "모델 성능"을 구분해 기술할 것
- 개선 계획: 실측 데이터 수집, `--pretrained` 전이학습, ROI/MAD 적용 전후 비교,
  EfficientNet-B0 비교 (모델 팩토리 구조로 아키텍처 교체 용이)

## 8. 추론 흐름

1. Spring Boot가 이미지+환경값을 multipart로 FastAPI에 전달
2. Predictor가 config.json 기준으로 학습과 동일한 전처리 적용 → 예측
3. 음수 클램프 후 {pm25, grade} 반환 → predictions 테이블 저장
