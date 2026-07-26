# 모델 정확도 비교 리포트 설계 (Phase 35)

- 작성일: 2026-07-26
- 상태: 사용자 승인(제안 목록에서 선택) 후 구현

## 목적

예측 저장 시 함께 기록되는 실측값(`predictions.actual_pm25`, Phase 20)을 이용해
모델(백본)별 **예측 vs 실측 정확도**를 집계·시각화한다. 최종 보고서·발표의 근거 자료.
기존 "모델 성능" 화면(AI 테스트 세트 지표)과 구분되는 **저장된 실운영 예측 기준** 지표다.

## 백엔드 — `GET /api/predictions/accuracy` 신설

- `PredictionRepository.findAllWithActual()`: actual_pm25가 있는 예측을
  모델·관측소 JOIN FETCH로 최신순 조회.
- `PredictionAccuracyService`: 모델명(modelName) 기준 그룹핑 후 집계 —
  - count, **MAE**, **RMSE**, **meanError**(예측-실측 평균, 양수면 과대예측 경향)
  - **gradeAccuracy**: 예측·실측 PM2.5를 동일 기준(`GradeProperties.gradeOf`)으로
    등급화해 일치 비율 (저장된 predicted_grade 대신 단일 기준으로 재계산)
  - **points**: 산점도용 (predictedPm25, actualPm25, predictedAt, siteName) —
    모델당 최신 300건 캡(`pointLimit` 필드로 명시, 집계는 전체 기준)
- 모델 정렬: 건수 내림차순. 실측 기록이 없으면 models=[].
- 권한: GET = USER/ADMIN (기존 규약).

## 프론트 — "모델 성능" 화면 확장

- 기존 AI 테스트 세트 지표 아래 "실측 대비 정확도 (저장된 예측 기준)" 절 추가:
  - 모델별 표: 건수 · MAE · RMSE · 평균 오차(±) · 등급 일치율
  - 산점도(recharts ScatterChart): X=실측, Y=예측, 모델별 색상, y=x 대각 참조선
  - 실측 기록이 없으면 안내 문구("예측 실행 시 관측소에 최신 관측값이 있어야 기록됩니다")
- `api/client.ts`: `PredictionAccuracy` 타입 추가.

## 테스트

- 백엔드: `PredictionAccuracyServiceTest` — 모델별 집계값(MAE·RMSE·평균오차·등급 일치율)
  수치 검증, 실측 없음 → 빈 목록, 포인트 캡.
- 프론트: tsc·빌드·Vitest(기존 + preAlerts). 실기동으로 응답 확인.

## 알려진 한계

- actual_pm25는 예측 실행 시점의 "관측소 최신 관측값"이라 시각 차가 있을 수 있다(간이 대조).
- 데이터가 적으면(수 건) 지표 변동이 크다 — 화면에 건수를 함께 표시한다.
