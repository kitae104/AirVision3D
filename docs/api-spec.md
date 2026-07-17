# API 명세서

상세 스키마는 Swagger 참조: Backend `http://localhost:8080/swagger-ui.html`, AI `http://localhost:8000/docs`

## 공통

- 응답 형식: `{ "success": bool, "data": {}, "message": string|null, "timestamp": "ISO-8601" }`
- 인증: `Authorization: Bearer <JWT>` (로그인·헬스체크·Swagger 제외)
- 권한: **GET = USER/ADMIN**, **등록·수정·삭제·실행 = ADMIN**
- 오류: 400(입력 오류), 401(미인증), 403(권한 없음), 404(없음), 409(중복), 502(AI 서비스 연결 불가)

## Backend (Spring Boot :8080)

### 인증
| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | /api/auth/login | 로그인 → {token, username, name, role} |
| GET | /api/auth/me | 현재 사용자 확인 |

### 관측소
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | /api/sites | 목록 |
| GET | /api/sites/{id} | 상세 (+geomWkt PostGIS 좌표) |
| POST | /api/sites | 등록 {name, latitude, longitude, altitude?, siteType?, description?} |
| PUT | /api/sites/{id} | 수정 |
| DELETE | /api/sites/{id} | 삭제 (관측값 CASCADE) |

### 관측값
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | /api/observations?siteId&from&to&page&size | 목록 (필터·페이지네이션, 최신순) |
| GET | /api/observations/{id} | 상세 |
| POST | /api/observations | 등록 {siteId, observedAt, pm10?, pm25?, temperature?, humidity?, windSpeed?, windDirection?} |
| PUT | /api/observations/{id} | 수정 |
| DELETE | /api/observations/{id} | 삭제 |

### AI 예측
| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | /api/predictions/run | multipart{siteId, image, temperature, humidity, windSpeed, modelName?} → 예측·저장. actual_pm25에 해당 관측소 최신 관측값 자동 기록 |
| GET | /api/predictions?siteId&page&size | 목록 (최신순) |
| GET | /api/predictions/models/{name}/metrics | 모델 성능지표 (AI 서비스 프록시) |

### IDW 보간
| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | /api/interpolations/run | {power?, observedAt?, targets:[{name?, latitude, longitude}]} → 보간·저장. 관측지점은 관측소별 최신 PM2.5 자동 사용, 거리 0이면 실제값 반환 |
| GET | /api/interpolations?page&size | 이력 (최신순) |

### 대시보드 / 시각화
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | /api/dashboard/summary | 최신 평균 PM2.5·등급·관측소 수·24h 예측/보간 건수 |
| GET | /api/dashboard/hourly?hours | 시간별 평균 PM2.5 (기본 24, 최대 168) |
| GET | /api/viz/observations/latest | 관측소별 최신 관측 (3D 관측 레이어) |
| GET | /api/viz/predictions/latest | 관측소별 최신 예측 (3D 예측 레이어) |
| GET | /api/viz/observations/time-range | 관측 데이터 존재 범위 {from, to} |
| GET | /api/viz/observations/series?from&to | 관측소별 PM2.5 시계열 (최대 7일) |

### 기타
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | /api/health | 헬스체크 (인증 불필요) |

## AI Service (FastAPI :8000)

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | /health | 헬스체크 |
| GET | /models | 저장된 모델 목록 |
| GET | /models/{name}/metrics | 테스트 성능지표 (회귀+등급) |
| POST | /models/train | 학습 실행 (동기, 소규모 데이터용). CLI: `scripts/train_model.py` |
| POST | /models/{name}/predict | multipart{image, temperature, humidity, wind_speed} → {pm25, grade} |

- 모델명은 `[A-Za-z0-9_.-]{1,64}` 만 허용 (경로 조작 방지)
- 학습 dataset_dir는 data/ 내부 경로만 허용

## 미세먼지 등급 기준 (단일 소스)

| 등급 | PM2.5 (㎍/㎥) | 색상 |
|---|---|---|
| 좋음 | 0~15 | 파랑 |
| 보통 | 15 초과~35 | 초록 |
| 나쁨 | 35 초과~75 | 주황 |
| 매우나쁨 | 75 초과 | 빨강 |

관리 위치: backend `application.yml(airvision.pm25-grades)` / ai-service `config/grades.json` / frontend `src/config/grades.ts` — 세 곳 값을 동일하게 유지한다.
