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
| POST | /api/observations/csv | CSV 일괄 업로드 (multipart `file`). 헤더 필수 site_id, observed_at · 선택 pm10, pm25, temperature, humidity, wind_speed, wind_direction. 시각은 ISO-8601 또는 타임존 없는 KST. (관측소, 시각) 중복은 건너뜀, 최대 10,000행. 응답 {totalRows, inserted, duplicateSkipped, failed, errors[{line, message}]} |
| PUT | /api/observations/{id} | 수정 |
| DELETE | /api/observations/{id} | 삭제 |

### AI 예측
| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | /api/predictions/run | multipart{siteId, image, temperature, humidity, windSpeed, modelName?} → 예측·저장. actual_pm25에 해당 관측소 최신 관측값 자동 기록 |
| GET | /api/predictions?siteId&page&size | 목록 (최신순) |
| GET | /api/predictions/models/{name}/metrics | 모델 성능지표 (AI 서비스 프록시) |
| POST | /api/predictions/cctv | multipart{siteId, image, temperature, humidity, modelName?} → CCTV 이미지 즉시 추정(저장 안 함). 주간: AI 추론 + 최근접 실측 비율 PM10 + Koschmieder 간이 가시거리. 야간(태양고도<0도): 최근접 AirKorea 실측 대체(mode=STATION_FALLBACK) |

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

### 바람장 / 확산(이류) 예측 (Phase 28)
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | /api/wind/field | 중부권 서해~동해(125.70~129.50, 36.90~38.10) 40×20 시간별 바람장 {bounds, width, height, baseTime, mock, stale, hours[{time, u[], v[], speedMin, speedMax}]}. 기상청 초단기예보 UUU/VVV(+6h), 내륙·도서 샘플 29지점 IDW, row 0=남쪽 row-major |
| GET | /api/wind/advection?hours=6 | PM2.5·PM10 단순 이류 예측 (semi-Lagrangian, advection-only, 1~6시간) {bounds, width, height, model, mock, frames[{time, pm25[], pm10[]?}]}. 초기장은 AirKorea 인천·서울·경기·강원·충북·충남 실측 IDW(일부 시도 실패 허용) |
| GET | /api/air-quality/district-forecast?hours=6 | 미추홀·남동·연수 구별 요약: current[{district, pm25, pm10, wind{speedMs, directionDeg, directionText, movementText}}] + hourly[{time, districts[...]}]. 기존 /api/air-quality/forecast(예보통보)와 별개 |

### 실시간 CCTV
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | /api/cctv/streams | 인천 미추홀·남동·연수구 실시간 도로 CCTV 목록 {mock, stale, loadedAt, source, count, cameras[{name, district, latitude, longitude, streamUrl, format}]}. ITS 국가교통정보센터 OpenAPI(cctvType=1, HLS), 5분 캐시. 키(ITS_CCTV_KEY, its.go.kr 발급) 미설정 시 Mock(카메라 위치만, streamUrl 빈 값) |

### 악취 모니터링
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | /api/odor/measurements | 인천환경공단 사업소(가좌·승기·송도) 주변 복합악취 희석배수 측정 현황. 측정지점 단위 집계 {mock, stale, loadedAt, spotCount, spots[{office, spotName, address, latitude, longitude, locationAvailable, latestDate, latestDilution, maxDilution, measurementCount}], failedOffices}. 공공데이터포털 odcloud 자동변환 API(연 단위 개방), 키 미설정 시 Mock. 공공 대기질 API 명세는 docs/public-data-api-integration.md 참조 |

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
| POST | /models/train | 학습 실행 (동기, 소규모 데이터용). backbone: resnet18(기본)/convnext_tiny/swin_t. CLI: `scripts/train_model.py --backbone ...` |
| POST | /models/{name}/predict | multipart{image, temperature, humidity, wind_speed, latitude?, longitude?, captured_at?} → {pm25, grade} |

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
