# AirVision 3D 진행 상황

> 상태 정의: NOT_STARTED / IN_PROGRESS / BLOCKED / COMPLETED(코드 작성 완료) / VERIFIED(실행·테스트 성공 확인)
> 갱신 규칙: 각 작업 완료 시 본 문서를 갱신한다. 테스트를 실행하지 못한 경우 사유를 기록한다.

최종 갱신: 2026-07-17

## Phase 요약

| Phase | 내용 | 상태 | 비고 |
|---|---|---|---|
| 0 | 저장소 분석과 계획 | VERIFIED | 계획 사용자 승인 완료 |
| 1 | 프로젝트 기반 구축 | VERIFIED | Docker 제외 결정(2026-07-17)으로 잔여 항목 소멸. 전 항목 로컬 검증 완료 |
| 2 | 데이터베이스 및 샘플 데이터 | VERIFIED | 원격 DB에서 Flyway 적용·CRUD·PostGIS 검증 완료(2026-07-17). JWT/CSV는 후속 |
| 3 | IDW 보간 | VERIFIED | 단위 테스트 + Python 교차검증(1e-6) + 실 DB API 검증 완료(2026-07-17). Modified IDW는 선택 |
| 4 | AI 데이터 파이프라인 | VERIFIED | 전처리·분할·Dataset 테스트 25건 통과, 샘플 120장 생성·DataLoader 확인(2026-07-17) |
| 5 | AI 모델 학습과 추론 | VERIFIED | 학습 CLI·추론 API·지표 6종 실검증 완료(2026-07-18). Spring 연동은 후속 |
| 6 | 웹 대시보드 | COMPLETED | 화면 8종+JWT 인증 구현, 빌드·API 흐름 검증 완료. 브라우저 육안 확인만 대기(2026-07-18) |
| 7 | CesiumJS 지도 | COMPLETED | 3D 레이어·격자·팝업·토글·카메라 구현, 빌드·API 검증 완료. 브라우저 육안 확인 대기(2026-07-18) |
| 8 | 시계열 시각화 | COMPLETED | 시계열 API·Clock/Timeline·시간별 색상/라벨 구현, 빌드·API 검증 완료. 브라우저 육안 확인 대기(2026-07-18) |
| 9 | 통합 테스트와 배포 | VERIFIED | 통합 테스트 29건 통과, 산출물 문서 11종 작성(2026-07-18). 브라우저 육안 확인만 잔여 |

## Phase 0. 저장소 분석과 계획 — COMPLETED

- 구현한 기능: 없음(분석·계획 단계)
- 변경한 파일: `docs/implementation-plan.md`(신규), `docs/progress.md`(신규)
- 실행 방법: 해당 없음
- 테스트 결과: 해당 없음
- 미완료 항목: 사용자 확인 질문 5건 답변 대기(데이터 확보, GPU, Cesium ion, 배포 대상, 팀 숙련도)
- 알려진 문제: 없음
- 다음 단계: Phase 1 프로젝트 기반 구축

## Phase 1. 프로젝트 기반 구축 — VERIFIED (2026-07-17)

> 인프라 결정 변경: 사용자 결정으로 Docker를 사용하지 않고 **원격 PostgreSQL 직접 연결**로 확정.
> docker-compose.yml, Dockerfile 3종, .dockerignore 3종 삭제. PostGIS 활성화 스크립트는
> `database/setup/`으로 이동. DB 접속 정보 입력 위치는 루트 `.env` (README 참고).

완료 조건 체크리스트:

- [x] git 저장소 초기화 및 .gitignore — VERIFIED
- [x] 모노레포 디렉터리 구조 생성 — VERIFIED
- [x] Spring Boot 4.1 프로젝트 생성(Java 21, Gradle 9) — VERIFIED (`gradlew build` 성공, 단위 테스트 1건 통과)
- [x] FastAPI 프로젝트 생성 — VERIFIED (pytest 1건 통과)
- [x] React 19 + Vite 8 + TS + Tailwind 4 프로젝트 생성 — VERIFIED (`npm run build` 성공)
- [x] DB 연결 설정(.env 기반) 및 PostGIS 초기화 스크립트 — VERIFIED (Docker 방식은 범위 제외로 삭제)
- [x] .env.example 작성 — VERIFIED
- [x] backend 헬스체크 응답 확인 — VERIFIED (bootRun 후 GET /api/health 200, 공통 응답 형식 확인)
- [x] ai-service 헬스체크 응답 확인 — VERIFIED (uvicorn 후 GET /health 200, 공통 응답 형식 확인)
- [x] frontend 기본 화면 접근 확인 — VERIFIED (dev 서버 HTTP 200, 타이틀 확인)
- [x] README 실행 방법 작성 — COMPLETED

### 알려진 문제

- Spring Boot는 계획의 3.x 대신 4.1 사용 (start.spring.io가 3.x 생성 종료). 테스트 애노테이션 패키지가
  `org.springframework.boot.webmvc.test.autoconfigure`로 변경된 점에 주의.

## Phase 2. 데이터베이스 및 샘플 데이터 — IN_PROGRESS (2026-07-17)

- [x] Flyway V1: 8개 테이블 스키마(users, observation_sites, observations, images,
      ai_models, model_metrics, predictions, interpolation_results) + 인덱스/FK/유일성 제약
      + PostGIS geom GENERATED 컬럼 — COMPLETED
- [x] Flyway V2: 샘플 데이터(수도권 관측소 7곳, 관측소별 최근 7일 시간당 관측값 합성 생성) — COMPLETED
- [x] 엔티티/Repository: ObservationSite, Observation (+ Specification 검색) — COMPLETED
- [x] CRUD API: /api/sites, /api/observations (목록·상세·등록·수정·삭제, 페이지네이션·기간 필터) — COMPLETED
- [x] 공통 예외 처리(GlobalExceptionHandler: 404/400/409/500 → 공통 응답 형식) — VERIFIED (슬라이스 테스트)
- [x] Swagger(springdoc) 의존성 추가 — COMPLETED (/swagger-ui.html, 실행 확인은 DB 연결 후)
- [x] 컨트롤러 슬라이스 테스트 14건 (mock 서비스, DB 불필요) — VERIFIED (gradlew build 통과)
- [x] 실 DB 검증 — VERIFIED (2026-07-17, 원격 PostgreSQL 114.71.147.30:25432)
      ① Flyway V1·V2 적용 성공 (PostGIS 확장 자동 활성화 포함)
      ② GET /api/sites → 샘플 관측소 7곳 조회 (한글 정상)
      ③ geomWkt = POINT(126.978 37.5665) → PostGIS 저장·조회 확인
      ④ 관측소 등록→수정→삭제→404 왕복, 관측값 등록·필터 조회(샘플 1,184건) 확인
      ⑤ 잘못된 위도 입력 → 400, Swagger UI → 200
- [ ] 사용자 인증(JWT) — 후속 진행 (로그인 화면과 함께 Phase 6 전후 예정)
- [ ] CSV 업로드 — **사용자 결정으로 보류(2026-07-17)**: 업로드할 실측 CSV가 아직 없음.
      실측 데이터(예: 에어코리아) 확보 시 진행. 스키마: site_id, observed_at, pm10, pm25,
      temperature, humidity, wind_speed, wind_direction

### 참고

- 백엔드는 기동 시 DB 연결이 필수다(JPA+Flyway). DB 없이 실행하면 기동 실패가 정상 동작이다.
- Spring Boot 4에서 Flyway는 `flyway-core` 직접 의존이 아니라 `spring-boot-starter-flyway`를
  사용해야 자동 실행된다 (미사용 시 마이그레이션이 조용히 생략됨 — 실측으로 확인).
- V1 마이그레이션 첫 구문에서 `CREATE EXTENSION IF NOT EXISTS postgis`를 수행한다.
  DB 계정에 권한이 없으면 database/setup/01-enable-postgis.sql을 관리자로 실행할 것.

## Phase 3. IDW 보간 — VERIFIED (2026-07-17)

- [x] Haversine 거리 함수 (GeoUtils, R=6371.0088km) — VERIFIED
- [x] 일반 IDW 구현 (IdwInterpolator: p 설정 가능, 거리 0 → 실제값 반환) — VERIFIED
- [x] 입력 검증 (빈 관측지점/비양수 p → 400, 좌표 범위 검증) — VERIFIED
- [x] 단위 테스트 12건 (거리 4건 + IDW 8건) — VERIFIED
- [x] Python 기준 구현(scripts/idw_reference.py)과 허용오차 1e-6 이내 일치 — VERIFIED
- [x] 보간 API (POST /api/interpolations/run, GET /api/interpolations) — VERIFIED (실 DB)
- [x] 보간 결과 DB 저장 (interpolation_results) — VERIFIED (3건 저장·조회 확인)
- [x] 테스트 결과 문서화 — docs/idw-algorithm.md
- [ ] Modified IDW — 선택 기능, 필수 전체 VERIFIED 후 착수

실 DB 검증 내용: 임의 2개 지점(서울숲 14.0185, 김포공항 17.8273) 보간 성공,
관측소 동일 좌표 입력 시 해당 관측소 최신 실제 관측값(5.1) 그대로 반환 확인.

## Phase 4. AI 데이터 파이프라인 — VERIFIED (2026-07-17)

- [x] 데이터셋 디렉터리 구조·CSV 스키마 정의 (app/data/schema.py, labels.csv 7컬럼) — VERIFIED
- [x] 이미지 전처리: 리사이즈·[0,1]·ImageNet 정규화 (app/preprocessing/image_ops.py) — VERIFIED
- [x] ROI 추출: 설정값(x,y,width,height) 기반, 범위 검증 포함 — VERIFIED
- [x] MAD 기반 픽셀 이상치 확인·보정 (k=3.5, 1.4826 스케일) — VERIFIED
- [x] 환경데이터 정규화: EnvScaler(z-score, train으로만 fit, JSON 저장/로드) — VERIFIED
- [x] PyTorch Dataset/DataLoader: 이미지(3,S,S)+환경(3,)+타깃(1,) — VERIFIED
- [x] 학습/검증/테스트 분리: **날짜 단위**(누수 방지), 시드 고정, 누수 검증 게이트 — VERIFIED
- [x] 샘플 데이터 생성기: PM2.5 상관 안개 합성 이미지 (app/sample/generator.py + CLI) — VERIFIED
- [x] pytest 25건 통과, 실제 생성(3관측소×5일×8장=120장, data/sample/dataset) 후
      분할 72/24/24 및 DataLoader 배치 (8,3,224,224) 확인

### 참고

- 합성 데이터셋은 git에 커밋하지 않는다(.gitignore). 재생성:
  `cd ai-service; .venv\Scripts\python scripts/generate_sample_dataset.py`
- 합성 데이터는 파이프라인 검증용이다. 실데이터 성능과 구분해 보고서에 기술할 것.
- AI 의존성 추가: torch 2.13(CPU), torchvision 0.28, numpy, pandas, pillow

## Phase 5. AI 모델 학습과 추론 — VERIFIED (2026-07-18)

- [x] ResNet18 멀티모달 회귀 모델 (이미지 512차원 + 환경 3차원 → PM2.5 1개) — VERIFIED
- [x] ImageNet 사전학습 가중치 사용 여부 설정 가능 (--pretrained / API pretrained) — COMPLETED
      (기본 False로 검증. pretrained=True는 최초 실행 시 가중치 다운로드 필요)
- [x] 학습 스크립트 (scripts/train_model.py CLI + POST /models/train 동기 API) — VERIFIED
- [x] 평가: MAE·RMSE·MAPE·R²(회귀) / 등급 정확도·혼동행렬(분류) 구분 산출 — VERIFIED
- [x] 등급 계산: config/grades.json 설정 파일 관리 (좋음≤15/보통≤35/나쁨≤75/매우나쁨) — VERIFIED
- [x] 모델 저장/로드: model.pt(weights_only)+config+scaler+history+metrics — VERIFIED
- [x] 추론 API: POST /models/{name}/predict (multipart 이미지+환경값) — VERIFIED
- [x] 모델 목록/성능 조회 API: GET /models, GET /models/{name}/metrics — VERIFIED
- [x] pytest 52건 통과 (1 epoch smoke, Predictor, API 404 포함)
- [x] 실검증: 샘플 120장 5 epochs CPU 학습(~2분) → 추론 pm25=31.94 '보통' 응답 확인
- [x] Spring Boot 연동 (predictions 테이블 저장) — VERIFIED (2026-07-18)
      · POST /api/predictions/run (multipart 이미지+환경값) → AI 추론 → ai_models 업서트
        → predictions 저장 (actual_pm25는 해당 관측소 최신 관측값 자동 기록)
      · GET /api/predictions (목록·관측소 필터), GET /api/predictions/models/{name}/metrics (프록시)
      · AI 서비스 중단 시 502 + 안내 메시지 확인. 컨트롤러 테스트 5건 포함 총 36건 통과
      · 트러블슈팅: Boot 4 기본 JDK HttpClient가 chunked+h2c로 전송해 uvicorn이 multipart를
        못 읽는 문제 → SimpleClientHttpRequestFactory(Content-Length 버퍼 전송)로 해결.
        MultipartBodyBuilder는 reactive-streams 의존성 필요(추가함)
- [ ] 선택 실험 (EfficientNet 비교, 전이학습/ROI/보정 전후 비교) — 선택 기능

### 참고

- 샘플 학습 지표(MAE 11.9, R² -0.84)는 합성 120장·5 epochs 결과로 **파이프라인 검증용**이다.
  실데이터 성능으로 인용 금지. 모델 파일(*.pt)은 git 미포함 — 재생성:
  `cd ai-service; .venv\Scripts\python scripts/train_model.py --epochs 5`
- 서버 검증 시 localhost 대신 127.0.0.1 사용 권장 (Windows IPv6 해석 지연 이슈)

## Phase 6. 웹 대시보드 — COMPLETED (2026-07-18)

### 백엔드 (VERIFIED)

- [x] JWT 인증: 로그인 API, JwtService(HS256), JwtAuthFilter, SecurityConfig — VERIFIED
      (무토큰 401, USER의 쓰기 요청 403, 잘못된 비밀번호 401, admin/user 로그인 200 실측)
- [x] 권한: GET=USER/ADMIN, 쓰기/실행=ADMIN, 헬스·로그인·Swagger 개방 — VERIFIED
- [x] 기본 계정 자동 생성(admin/user, 비밀번호 env 교체 가능) — VERIFIED
- [x] CORS(5173 개발 서버) — COMPLETED
- [x] 대시보드 API: /api/dashboard/summary, /api/dashboard/hourly — VERIFIED (실 DB)
- [x] 등급 기준 설정화(airvision.pm25-grades, @ConfigurationProperties) — VERIFIED

### 프론트엔드 (COMPLETED — 브라우저 육안 확인 대기)

- [x] 로그인 화면(JWT 저장·자동 첨부·401 시 자동 로그아웃) — COMPLETED
- [x] 대시보드(요약 카드 5종 + 시간별 PM2.5 차트 + 관측vs예측 차트, Recharts) — COMPLETED
- [x] 관측 데이터 목록(관측소 필터·페이지네이션·ADMIN 삭제) — COMPLETED
- [x] 데이터 등록(관측소/관측값 폼, ADMIN 전용) — COMPLETED
- [x] AI 예측 실행(이미지 업로드+환경값 → 결과 카드+최근 이력) — COMPLETED
- [x] IDW 보간 실행(동적 대상 목록+p 설정 → 결과 카드+이력) — COMPLETED
- [x] 모델 성능(회귀/등급 지표 구분 표시 + 혼동행렬) — COMPLETED
- [x] 3D 지도 자리표시자(Phase 7 안내) — COMPLETED
- [x] 오류·로딩 처리(공통 errorMessage, 로딩 상태, 폼 검증) — COMPLETED
- [x] `npm run build`(tsc+vite) 통과, dev 서버 서빙 확인 — VERIFIED
- [x] 화면과 동일한 API 흐름(관측소·관측값 등록, 예측, 보간) 스크립트 검증 — VERIFIED
- [ ] 브라우저 육안 확인 — Chrome 확장 미연결로 자동 검증 불가. 사용자 확인 필요:
      http://localhost:5173 접속 → admin/admin1234! 로그인 → 각 화면 확인

### 트러블슈팅 기록

- @WebMvcTest 슬라이스는 Filter 컴포넌트를 포함하므로 JwtAuthFilter를 @Component로 두면
  테스트가 깨짐 → SecurityConfig에서 직접 생성으로 변경
- Boot 4에서 SecurityConfig 생성 시점에 ObjectMapper 빈 주입 불가 → 자체 생성(JavaTime 모듈)
- 기본 계정 생성(CommandLineRunner)은 헬스체크 UP 직후 약 1초 뒤 완료 — 기동 직후 로그인 주의

## Phase 7. CesiumJS 지도 — COMPLETED (2026-07-18)

### 백엔드 (VERIFIED)

- [x] 시각화 API: GET /api/viz/observations/latest (관측소별 최신 관측, 7개 지점 확인),
      GET /api/viz/predictions/latest (관측소별 최신 예측, DISTINCT ON) — VERIFIED (실 DB)

### 프론트엔드 (COMPLETED — 브라우저 육안 확인 대기)

- [x] Cesium Viewer 구성: cesium npm + vite-plugin-static-copy(/cesium 자산 서빙),
      CESIUM_BASE_URL 설정. ion 토큰 없으면 OSM 타일 폴백(토큰은 VITE_CESIUM_ION_TOKEN)
- [x] 관측소/예측/보간 지점 마커(포인트+라벨, 레이어별 색상) — COMPLETED
- [x] 미세먼지 3D 박스 격자: 관측소당 3x3x2 (config/mapConfig.ts에서 크기·간격·투명도 관리) — COMPLETED
- [x] 농도별 색상: 등급 설정(config/grades.ts) 공유 — COMPLETED
- [x] 객체 클릭 상세정보(InfoBox: 구분·PM2.5·등급·시각·좌표) — COMPLETED
- [x] 레이어 표시/숨김 토글 3종 — COMPLETED
- [x] 관측소 선택 → 카메라 flyTo — COMPLETED
- [x] 등급 범례 표시 — COMPLETED
- [x] npm run build 통과, /cesium/Widgets/widgets.css 200, /map 서빙 200 — VERIFIED
- [ ] 브라우저 육안 확인 — 사용자 확인 필요 (http://localhost:5173/map)
- [ ] 화면 캡처 기능 — 선택 기능(후순위)

### 알려진 문제

- 번들 크기 경고(Cesium 포함 4.7MB, gzip 1.3MB). 필요 시 MapPage lazy import로 코드 분할 예정.

## Phase 8. 시계열 시각화 — COMPLETED (2026-07-18)

### 백엔드 (VERIFIED)

- [x] GET /api/viz/observations/time-range — 데이터 존재 범위 반환 (7/10~7/17 확인)
- [x] GET /api/viz/observations/series?from&to — 기간 내 관측소별 PM2.5 시계열
      (7개 관측소 × 시간당 샘플 확인, 최대 7일 제한, from>to·기간 초과 시 400) — VERIFIED

### 프론트엔드 (COMPLETED — 브라우저 육안 확인 대기)

- [x] Cesium Clock/Timeline 연동 (Viewer animation·timeline 위젯 활성화) — COMPLETED
- [x] 시간에 따른 격자 색상 변경: TimeIntervalCollectionProperty(1시간 구간) — COMPLETED
- [x] 시간에 따른 라벨 변경: 관측소명 + 시각별 PM2.5·등급 — COMPLETED
- [x] 재생/일시정지/배속: Cesium 애니메이션 위젯 (기본 배속 900 = 1초당 15분) — COMPLETED
- [x] 날짜·시간 범위 선택: datetime-local 2개 + [시계열 로드], 기본값은 데이터 마지막 24시간 — COMPLETED
- [x] 데이터 없는 시간 처리: entity availability로 해당 구간 격자 숨김 — COMPLETED
- [x] [현재값 보기]로 최신값 모드 복귀 — COMPLETED
- [x] npm run build 통과 — VERIFIED
- [ ] 브라우저 육안 확인 — 사용자 확인 필요: /map에서 기간 선택 → 시계열 로드 → 재생 시
      격자 색·라벨 변화 확인

## Phase 9. 통합 테스트와 배포 — VERIFIED (2026-07-18)

- [x] 자동 통합 테스트: scripts/integration-test.ps1 — **29 PASS / 0 FAIL** (실 DB·실 AI 서비스)
      헬스체크·인증/권한·CRUD+PostGIS·대시보드·IDW(동일좌표 실측 일치)·AI 예측·시각화/시계열
- [x] 오류 상황 점검: 401/403/400/404/502 전 경로 통합 테스트에 포함 — VERIFIED
- [x] README 완성 (run.ps1·통합 테스트·문서 색인) — VERIFIED
- [x] 시연 시나리오 (docs/demo-scenario.md, 예상 질문 포함) — COMPLETED
- [x] 결과보고서 목차 (docs/capstone-report-outline.md) — COMPLETED
- [x] 산출물 문서: requirements / architecture / database-design / api-spec /
      ai-model-design / ui-screen-spec / test-plan / deployment — COMPLETED
- [x] 통합 실행 스크립트 run.ps1 (+-Stop) — VERIFIED
- [x] 사용 설명서 docs/user-guide.html (초보자용, 지속 갱신 문서. CLAUDE.md 작업 절차 9항에
      갱신 규칙 추가) — COMPLETED (2026-07-18)

### 잔여 항목 (사용자 확인 후 처리)

- Phase 6~8 브라우저 육안 확인 → 확인 시 해당 Phase VERIFIED 승격
- 보류/선택: CSV 업로드(실측 데이터 확보 시), Modified IDW, EfficientNet 비교,
  웹 ROI, CZML, 듀얼맵, 화면 캡처, 7x7x3 격자, 프론트 컴포넌트 테스트

## 확인 대기 사항 (BLOCKED 아님, 기본 가정으로 진행 가능)

| # | 질문 | 기본 가정 |
|---|---|---|
| 1 | 실제 라벨링 데이터 확보 가능 여부 | 합성 샘플 데이터로 파이프라인 우선 검증 |
| 2 | GPU 사용 가능 여부 | CPU 기준 설계 |
| 3 | Cesium ion 토큰 | OSM imagery 폴백 |
| 4 | 배포 대상 | 로컬 Docker Compose 시연 |
| 5 | 팀 숙련도 | 역할별 균등 분담 |

## Phase 10. 공공 대기환경 API 연동 — COMPLETED (2026-07-18)

계획: docs/implementation-plan.md "Public Air Quality API Integration" 섹션.
상세 문서: docs/public-data-api-integration.md

- [x] 공통 기반: TtlCache(장애 시 stale 폴백)·KstTimes(24:00 처리)·외부 API 예외 3종·설정 바인딩 — COMPLETED
- [x] 1단계 AirKorea 측정소·실시간: 클라이언트(returnType=json, 이중 인코딩 방지, 1회 재시도),
      정규화(값/-/플래그/등급, 0≠결측), Mock fixture, /api/air-quality/stations·current — COMPLETED
- [x] 2단계 3D 지도: airkorea 레이어(등급색 원기둥 막대+정규화 높이+텍스트 등급 병기),
      기준 오염물질 선택(PM2.5/PM10/KHAI), 데이터 없음 △ 표시, Mock·stale 배너 — COMPLETED
- [x] 3단계 기상청: 격자 변환(LCC DFS)+발표주기 base_time, 초단기실황·예보,
      풍향 16방위+화살표(이동 방향 반전), /api/weather/* — COMPLETED
- [x] 4단계 예보·경보: 공공 대기질 페이지(/public-air), 활성 경보 배너, 주간예보 — COMPLETED
- [x] 5단계 AI 비교: 최근접 유효 측정소 매칭(5km·60분), 절대오차·오차율(실측 0 생략),
      매칭 불가 사유 반환, /api/air-quality/comparison/* — COMPLETED
- [x] 대시보드 공공 카드 5종(현재/기상/예보/AI비교/상태), /api/public-data/status — COMPLETED
- [x] 백엔드 테스트 63건 추가 → 총 102건 통과, 프론트 빌드·oxlint 통과 — VERIFIED (2026-07-18)
- [x] Mock 모드 실기동 검증: 백엔드 bootRun 후 신규 15개 엔드포인트 실호출 확인 — VERIFIED (2026-07-18)
- [x] 실 서비스키로 실 API 응답 검증 — VERIFIED (2026-07-18 사용자 키 입력 후 확인:
      Mock 자동 해제, 인천 실측정소 43곳·기상 실황·예보 3일·주간예보·경보 271건 정상 수신.
      실 응답 기반 보완 2건 — ① 24시간 등급 누락 측정소는 1시간 등급(pm10/pm25Grade1h)
      폴백 사용, ② 경보 numOfRows 200→1000 상향. 테스트 총 103건 통과)
