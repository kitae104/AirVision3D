# 테스트 계획 및 결과서

최종 갱신: 2026-07-18. 상태 표기는 docs/progress.md 기준(VERIFIED = 실제 실행·통과 확인).

## 1. 자동 테스트 인벤토리

### Backend (JUnit, 39건) — `cd backend; .\gradlew.bat test`

| 영역 | 건수 | 내용 |
|---|---|---|
| 헬스체크 | 1 | 공통 응답 형식 |
| 관측소 컨트롤러 | 9 | CRUD·검증 400·404·geomWkt |
| 관측값 컨트롤러 | 5 | 등록·필터 조회·검증(습도/음수 pm25/필수값) |
| 보간 컨트롤러 | 4 | 실행 201·빈 대상/음수 p/위도 누락 400 |
| 예측 컨트롤러 | 5 | multipart 201·빈 이미지 400·AI 다운 502·목록 |
| 인증 컨트롤러 | 3 | 로그인 성공·401·빈 아이디 400 |
| GeoUtils | 4 | Haversine (Python 기준값 1e-6 일치, 대칭성) |
| IDW | 8 | p=1/2/3 기준값 일치·거리0·단일·범위·예외 |

### AI Service (pytest, 60건) — `cd ai-service; .venv\Scripts\python -m pytest`

| 영역 | 건수 | 내용 |
|---|---|---|
| 헬스체크 | 1 | 공통 응답 형식 |
| 이미지 전처리 | 10 | 리사이즈·ROI(범위/음수)·정규화·MAD 보정·CHW 변환 |
| 데이터 분할 | 7 | 날짜 중복 없음·행 보존·결정성·누수 감지 게이트 |
| Dataset/Scaler | 7 | 스키마 검증·scaler 저장/로드·표준화·배치 shape·DataLoader e2e |
| 등급/지표 | 13 | 등급 경계 파라미터화·MAE/RMSE/MAPE 수기값·혼동행렬 |
| 모델/학습/추론 | 14 | forward shape·1 epoch smoke·파일 생성·Predictor·API 200/404 |
| 보안 | 8 | 모델명 경로 조작 거부·dataset_dir 외부 경로 400 |

### Frontend — `cd frontend; npm run build` (tsc 타입 검사 + 번들)

### 통합 테스트 (29건) — `powershell -File scripts\integration-test.ps1`

헬스체크 3 · 인증/권한 5 · CRUD+PostGIS 8 · 대시보드 2 · IDW 3(동일좌표 실측 일치 포함) ·
AI 예측 4 · 시각화/시계열 4. **2026-07-18 실행 결과: 29 PASS / 0 FAIL**

## 2. 교차검증

- IDW: Java ↔ Python(scripts/idw_reference.py) 허용오차 1e-6 — 단위 테스트로 상시 검증
- AI 지표: 수기 계산값(MAE=2.75 등)과 대조

## 3. 수동 테스트 체크리스트 (브라우저)

| 항목 | 확인 방법 | 상태 |
|---|---|---|
| 로그인/권한별 메뉴 | user·admin 각각 로그인 | 육안 확인 대기 |
| 대시보드 카드·차트 | / 접속 | 육안 확인 대기 |
| 데이터 등록→목록 반영 | /data-entry → /observations | 육안 확인 대기 |
| AI 예측 실행 | /predict, 샘플 PNG 업로드 | 육안 확인 대기 |
| 보간 실행 | /interpolation | 육안 확인 대기 |
| 3D 격자·팝업·레이어·flyTo | /map | 육안 확인 대기 |
| 시계열 재생·배속·Timeline | /map 시계열 로드 | 육안 확인 대기 |

## 4. 미실행/제외 테스트와 사유

- Repository 슬라이스 테스트(@DataJpaTest): 로컬 DB 컨테이너 부재(Docker 미사용 결정)로 제외.
  대신 통합 테스트가 실 DB로 동일 경로를 검증
- 프론트엔드 컴포넌트 테스트(Vitest+RTL): 후순위. 빌드 타입 검사 + 통합 테스트로 대체 중
- GPU 학습: 환경 부재. CPU 5 epochs로 파이프라인만 검증
