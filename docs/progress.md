# AirVision 3D 진행 상황

> 상태 정의: NOT_STARTED / IN_PROGRESS / BLOCKED / COMPLETED(코드 작성 완료) / VERIFIED(실행·테스트 성공 확인)
> 갱신 규칙: 각 작업 완료 시 본 문서를 갱신한다. 테스트를 실행하지 못한 경우 사유를 기록한다.

최종 갱신: 2026-07-22

## Phase 요약

| Phase | 내용 | 상태 | 비고 |
|---|---|---|---|
| 0 | 저장소 분석과 계획 | VERIFIED | 계획 사용자 승인 완료 |
| 1 | 프로젝트 기반 구축 | VERIFIED | Docker 제외 결정(2026-07-17)으로 잔여 항목 소멸. 전 항목 로컬 검증 완료 |
| 2 | 데이터베이스 및 샘플 데이터 | VERIFIED | 원격 DB에서 Flyway 적용·CRUD·PostGIS 검증 완료(2026-07-17). JWT/CSV는 후속 |
| 3 | IDW 보간 | VERIFIED | 단위 테스트 + Python 교차검증(1e-6) + 실 DB API 검증 완료(2026-07-17). Modified IDW는 선택 |
| 4 | AI 데이터 파이프라인 | VERIFIED | 전처리·분할·Dataset 테스트 25건 통과, 샘플 120장 생성·DataLoader 확인(2026-07-17) |
| 5 | AI 모델 학습과 추론 | VERIFIED | 학습 CLI·추론 API·지표 6종 실검증 완료(2026-07-18). Spring 연동은 후속 |
| 6 | 웹 대시보드 | VERIFIED | 브라우저 육안 확인 완료(2026-07-22, Playwright): 로그인·대시보드·관측·등록·예측·보간·성능·공공 전 화면 렌더 확인 |
| 7 | CesiumJS 지도 | VERIFIED | 브라우저 육안 확인 완료(2026-07-22): 지도·마커·레이어 토글·InfoBox 팝업·카메라 이동 확인. StrictMode 비동기 경합 버그 발견·수정(아래 Phase 16) |
| 8 | 시계열 시각화 | VERIFIED | 브라우저 육안 확인 완료(2026-07-22): 시계열 로드→900x 재생·시계열 격자·팝업·[현재값 보기] 복귀 확인 |
| 9 | 통합 테스트와 배포 | VERIFIED | 통합 테스트 29건 통과, 산출물 문서 11종 작성(2026-07-18). 브라우저 육안 확인만 잔여 |
| 10 | 공공 대기환경 API 연동 | COMPLETED | 5단계 구현(측정소·지도·기상·예보·AI비교), 테스트 103건 통과, 실 서비스키 검증 완료 |
| 11 | 공공 데이터 시계열 축적 루프 | VERIFIED | 실 DB 실기동 검증(2026-07-18). 트랜잭션 버그 발견·수정, 수집 208건/재수집 멱등 확인, integration-test 33건 중 32 PASS(신규 4건 전부 PASS) |
| 12 | 실측 IDW 격자 표면(2순위 첫 기능) | VERIFIED | 백엔드 테스트 126건, 실기동 검증(2026-07-19): 인천 cells=100·sourceCount=41·mock=false, 서울 sourceCount=38, resolution=25→400 확인 |
| 13 | 시도 선택 UI + 공공 측정소 시계열 재생(2순위 나머지) | VERIFIED | 실 DB 검증(2026-07-21) + 브라우저 육안 확인(2026-07-22): 시도 전환 시 측정소·기상·IDW 표면 갱신·카메라 이동, 시계열→현재 복귀 시 공공 레이어 복원 확인 |
| 14 | 프론트엔드 컴포넌트 테스트 도입(3순위 1번) | VERIFIED | Vitest+RTL 도입, config 순수함수·AlertBanner 렌더 테스트 20건 통과(2026-07-21). 빌드·oxlint 무영향 |
| 15 | 경보 발령 시도 강조(3순위 2번) | VERIFIED | 강제 Mock 모드 육안 검증(2026-07-22): 인천 중심 주황 주의보 원+라벨, AlertBanner 동시 표시 확인 (Phase 18) |
| 16 | 브라우저 육안 확인 + 지도 결함 2건 수정(3순위 3번) | VERIFIED | Playwright로 전 화면 육안 확인(2026-07-22), Phase 6·7·8·13 VERIFIED 승격. StrictMode 비동기 경합("요청 처리 중 오류")·OSM z>19 CORS 오류 수정 |
| 17 | 지도 초기 뷰 인천 중심 + 전체화면 수정 | VERIFIED | 초기 카메라를 기본 시도(인천) 중심으로, 전체화면 대상을 body→지도 컨테이너로 수정. Playwright 실검증(2026-07-22): fullscreenElement=지도, 1536x720 전체 확대·ESC 복귀 확인 |
| 18 | 잔여 검증 일괄 처리(경보 Mock 검증·샘플 리시드·Minor 폴리시) | VERIFIED | 강제 Mock으로 경보 권역 육안 검증(Phase 15 승격), 리시드 511건→시간별 차트 24포인트 복구, IDW 경계값 테스트 2건(백엔드 130), stale 가드 일관화(2026-07-22) |
| 19 | 최종보고서 정합성 점검 + 인천 핵심 3구(미추홀·남동·연수) 중심화 | VERIFIED | 기반 문서(최종보고서 PDF 78쪽) 전수 확인·격차 분석. 초기 뷰 3구 조망+구 이동 버튼, V4 인천 관측소 6곳, 대시보드 인천 기준. 실 DB·Playwright 검증(2026-07-22) |
| 20 | 최종보고서 격차 기능 4종(Modified IDW·태양고도·듀얼맵·뷰어 유틸) | VERIFIED | Python 교차검증(1e-6)·백엔드(신규 11건)·AI 73건·프론트 34건 통과. 실 DB·실 AirKorea·Playwright 실검증(2026-07-22) |
| 21 | 듀얼맵 시계열 이력 재생(Phase 20 제약 해소) | VERIFIED | 우측 비교 뷰가 기간 내 예측·보간 이력을 좌측 시계와 동기 재생. 프론트 38건 통과, Playwright 실검증(2026-07-22) |
| 22 | 거리 측정 중 InfoBox 억제(Phase 20 제약 해소) | VERIFIED | 측정 중 뷰어 기본 클릭(엔티티 선택·더블클릭 추적) 제거→종료 시 복원. Playwright로 억제·복원 실검증(2026-07-22) |
| 23 | ion 토큰 env 적용 수정 + 듀얼맵 비교 전용 페이지 | VERIFIED | vite envDir 루트 지정으로 루트 .env 토큰 실적용, 위성 시작·[위성/일반] 전환 실검증. /dual-map 메뉴 신설(두 지도 상태로 시작). 프론트 38건 통과(2026-07-22) |
| 24 | 듀얼맵 비교 메뉴 제거(사용자 결정) | VERIFIED | /dual-map 라우트·메뉴·initialDual prop 되돌림(지도 내 듀얼맵 토글은 유지). 테스트·빌드 통과(2026-07-22) |

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

- ~~Phase 6~8 브라우저 육안 확인~~ → **완료(2026-07-22, Phase 16)**: 전 Phase VERIFIED 승격
- 보류/선택: CSV 업로드(실측 데이터 확보 시), Modified IDW, EfficientNet 비교,
  웹 ROI, CZML, 듀얼맵, 화면 캡처, 7x7x3 격자, ~~프론트 컴포넌트 테스트~~(Phase 14 완료)

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

## Phase 11. 공공 데이터 시계열 축적 루프 — VERIFIED (2026-07-18)

계획: `.superpowers/sdd/task-7-brief.md` 등 7개 태스크(TDD). V3 마이그레이션·엔티티·수집기·
이력 조회·대시보드 차트를 실 원격 PostgreSQL에 대해 최초로 실기동 검증했다.

### 구현 내용 (Task 1~6, 이전 커밋)

- [x] V3 마이그레이션: `public_air_measurement`, `public_weather_observation`,
      `comparison_history` 3개 테이블(+ 유일성 제약으로 ON CONFLICT 업서트 지원) — VERIFIED
      (`spring.jpa.hibernate.ddl-auto: validate`로 엔티티-스키마 일치 확인, 아래 참고)
- [x] 수집기(`PublicDataCollector`): 매시간 cron(`0 10 * * * *`) + 기동 시 1회
      (`collect-on-startup=true`) + 수동 `POST /api/public-data/collect`(ADMIN).
      시/도별·수집 단위별 개별 try/catch로 장애 격리, 네이티브 upsert로 멱등
- [x] 보존 정책: 매일 03:30 cron으로 `retention-days`(기본 180일) 이전 데이터 삭제
- [x] 조회 API: `GET /api/public-data/history/measurements/hourly`,
      `GET /api/public-data/history/summary`, `GET /api/public-data/history/comparison`,
      `GET /api/air-quality/comparison/history`(동일 데이터 위임)
- [x] 대시보드: 공공 실측 추이·AI 오차 추이 차트 2종 + 누적 건수 카드

### 실 DB 실기동 검증 (Task 7, 2026-07-18)

- [x] `.\run.ps1`로 backend(8080)+ai-service(8000)+frontend(5173) 동시 기동,
      3개 헬스체크 모두 OK 확인
- [x] **V3 마이그레이션 검증**: `ddl-auto: validate`로 최초 실 DB 기동 —
      `SchemaManagementException` 없이 정상 기동 확인 (Flyway 3개 마이그레이션 적용 로그,
      Hibernate 스키마 검증 통과)
- [x] **실행 중 발견한 실제 결함(수정 완료)**: 최초 기동/수동 수집 시
      `측정 수집 실패 (서울): No active transaction for update or delete query` 경고가
      매 시/도·매 수집 단위마다 발생, 결과적으로 `measurementsUpserted=0`,
      `accumulatedCount=0`으로 수집이 항상 빈 값을 반환하는 버그를 실 DB 기동에서
      최초로 발견했다(단위/슬라이스 테스트 117건은 `@DataJpaTest`류가 트랜잭션을 감싸주므로
      이 버그를 못 잡았음). 원인: `PublicAirMeasurementRepository.upsert`,
      `deleteByMeasuredAtBefore`, `PublicWeatherObservationRepository.upsert`,
      `deleteByBaseTimeBefore`, `ComparisonHistoryRepository.insertSnapshot` 5개
      `@Modifying` 네이티브 쿼리가 `@Transactional` 없이 선언되어 있고, 호출부인
      `PublicDataCollector.collectOnce()`도 (건별 개별 커밋 의도로) 의도적으로
      `@Transactional`을 붙이지 않아 활성 트랜잭션이 전혀 없는 상태로 실행되었기 때문.
      수정: 5개 리포지토리 메서드 각각에 `@Transactional`을 직접 추가(리포지토리
      인터페이스 메서드 단위 애노테이션은 Spring Data가 그대로 존중하므로, 건별로 개별
      트랜잭션이 열리는 원래 설계 의도(코드 주석)를 그대로 유지하면서 버그만 해결).
      수정 파일: `PublicAirMeasurementRepository.java`, `PublicWeatherObservationRepository.java`,
      `ComparisonHistoryRepository.java`. 수정 후 `gradlew test` 117건 재검증 통과,
      재기동 후 정상 수집 확인(아래).
- [x] **수집·누적 검증**: admin 로그인 → `POST /api/public-data/collect` →
      `measurementsUpserted=208`, `weatherUpserted=3`(mock=false, 실 API) →
      `GET /api/public-data/history/summary` → `accumulatedCount=208` 확인.
      재수집 1회 더 실행 → `accumulatedCount` 208 유지(중복 증가 없음, ON CONFLICT
      업서트 멱등성 확인). 시간별 이력(`/history/measurements/hourly`) 2건 조회 확인.
      (참고: `earliestCollectedAt`은 재수집 시 해당 로우들의 `collected_at`이
      `EXCLUDED.collected_at`으로 갱신되는 설계라 "마지막 수집 시각"에 가깝게 움직인다 —
      `accumulatedCount`가 핵심 멱등성 지표)
- [x] `scripts/integration-test.ps1`에 8번째 블록(공공 데이터 누적 4건) 추가:
      수동 수집 측정 1건 이상, 시간별 이력 조회, 누적 요약 건수, 오차 이력 조회 200
- [x] **전체 통합 테스트 결과: 33건 중 32 PASS / 1 FAIL** — 신규 4건 전부 PASS.
      기존 FAIL 1건("시간별 차트 데이터", `GET /api/dashboard/hourly?hours=24`)은
      Phase 11과 무관한 사전 존재 이슈: Phase 2 V2 샘플 데이터가 생성 시점(2026-07-17)
      기준 "최근 7일"로 고정 생성되어 있어, 달력일이 지나면서 `hours=24` 조회 창이
      최신 샘플 관측(2026-07-17T14:00Z)을 벗어나 빈 배열을 반환한다(현재 기준 관측 대비
      약 14분 초과). 코드 결함이 아니라 정적 샘플 데이터의 시간 경과에 따른 자연스러운
      드리프트이며, Phase 11 변경으로 유발되지 않았다(버그 수정 전 최초 실행에서도 동일하게
      실패). 재현: 샘플 데이터 재생성 또는 시연 직전 실행 시에는 정상 통과 예상.
- [x] `.env.example`에 수집 관련 3개 변수 주석 추가
      (`PUBLIC_DATA_COLLECTION_ENABLED`, `PUBLIC_DATA_COLLECT_ON_STARTUP`,
      `PUBLIC_DATA_RETENTION_DAYS`)

### 변경 파일

- `scripts/integration-test.ps1`(8번째 블록 추가), `.env.example`(수집 변수 주석),
  `docs/progress.md`(본 절)
- 실 DB 검증 중 발견한 결함 수정: `backend/src/main/java/com/airvision/backend/publicdata/history/PublicAirMeasurementRepository.java`,
  `PublicWeatherObservationRepository.java`, `ComparisonHistoryRepository.java`
  (각 `@Modifying` 메서드에 `@Transactional` 추가)

### 알려진 문제

- ~~`GET /api/dashboard/hourly?hours=24`가 Phase 2 정적 샘플 데이터 시간 경과로 빈 배열 반환~~
  → **해결(2026-07-19)**: `SampleObservationReseeder`(플래그 기반 CommandLineRunner) 추가.
  `bootRun --args='--airvision.sample.reseed=true'`로 현재 시각 기준 최근 7일 관측값을 삭제 없이
  보충(ON CONFLICT DO NOTHING). 실 DB 검증: 대시보드 24시간 조회 0→24건, 통합 테스트 33/33 PASS.
- `comparisonSnapshots`는 이번 실기동에서 0건(매칭되는 최근 AI 예측이 DB에 없었기 때문,
  Task4 설계상 정상 동작 — 예측을 먼저 실행해야 매칭 스냅샷이 쌓임).

## Phase 12. 실측 IDW 격자 표면(2순위 첫 기능) — VERIFIED (2026-07-19)

계획: `.superpowers/sdd/task-1-brief.md` ~ `task-3-brief.md` 3개 태스크. AirKorea 실측 다수 지점을
IDW로 보간해 지도에 색상 농도 면으로 표시하는 기능.

### 구현 내용 (Task 1~2, 이전 커밋)

- [x] 백엔드: `GET /api/air-quality/interpolation/grid?sido=&power=&resolution=` —
      시/도 실측 다수 지점을 bbox로 격자화(resolution×resolution, 2~20 범위)하고
      기존 `IdwInterpolator`·`GradeProperties`로 각 셀 pm25·등급 계산. `IdwGridResponse`
      DTO(sido·power·resolution·source·mock·stale·sourceCount·bbox·cells[]). 기존
      `IdwInterpolator`·`GradeProperties`·`AirKoreaService`는 무변경(주입만)
- [x] 프론트엔드: MapPage에 `idwSurface` 레이어(체크박스, 기본 꺼짐) — 셀별 색상 상자로
      타일링(높이 아닌 색으로 농도 표현), `config/mapConfig.ts`에 레이어 색상 추가
- [x] 백엔드 테스트 총 126건 통과 (서비스 bbox·격자·필터·검증 + 컨트롤러 슬라이스 포함)

### 실기동 검증 (Task 3, 2026-07-19)

- [x] `.\run.ps1 -Stop` → 포트 8080/8000/5173 미사용 확인 → `.\run.ps1` → 3개 헬스체크
      모두 OK 확인(신규 PID로 재기동 확인)
- [x] user 계정 로그인 후 `GET /api/air-quality/interpolation/grid?sido=인천&resolution=10` 실호출:
      `cells` 길이 **100**(10×10), `sourceCount` **41**(실측), `mock` **false**(실 AirKorea
      서비스키 사용 중), `bbox` 포함(minLatitude 36.94~maxLatitude 38.03 등), 모든 셀에
      숫자 `pm25`와 등급 문자열 `grade`("좋음" 등) 확인. 샘플 셀: `pm25=6.7, grade=좋음`
- [x] 두 번째 시/도로 일반화 확인: `sido=서울&resolution=10` → `sourceCount` **38**, `mock` **false**
- [x] resolution 경계값 확인: `resolution=20`(상한) → 200 정상, `resolution=25`(범위 초과) →
      **400** + 메시지 "resolution은 2~20 범위여야 합니다"
- [x] `.\run.ps1 -Stop`으로 정상 종료

### 변경 파일 (Task 3)

- `docs/progress.md`(본 절), `docs/user-guide.html`(§7 레이어 설명·버전 갱신)
- 소스 코드 변경 없음(검증·문서만)

## Phase 13. 시도 선택 UI + 공공 측정소 시계열 재생(2순위 나머지) — COMPLETED (2026-07-21)

2순위 제안의 나머지 두 항목을 구현했다. (a) 실측 IDW는 Phase 12에서 완료했고, 여기서
(b) 공공 측정소 시계열 재생과 (c) 시도 선택 UI를 마무리해 2순위를 종료한다.

### (c) 시도 선택 UI — 프론트 전용

- [x] `frontend/src/config/sido.ts` 신규: AirKorea 17개 시도명 + flyTo용 대략 중심좌표
      (백엔드 `AirKoreaService.SIDO_NAMES`와 동일 목록 유지)
- [x] MapPage 툴바에 시도 드롭다운 추가 → 선택 시 `/air-quality/current?sido=` 재조회로
      airkorea 측정소·풍향 갱신, IDW 표면은 `publicAir.sido` 변경에 따라 자동 재요청,
      해당 시도 중심으로 카메라 flyTo. 최초 로드 시 백엔드 해석 시도로 드롭다운 동기화
- [x] 백엔드는 무변경(이미 `?sido=` 지원). 실 API 경로 검증: `current?sido=서울` → 40측정소
      mock=false (Phase 10·12에서 서울 38·인천 41 소스도 기검증)

### (b) 공공 측정소 시계열 재생 — 백엔드 + 프론트

- [x] 백엔드 신규 엔드포인트 `GET /api/public-data/history/measurements/series?sido=&from=&to=`
      → 시도 내 측정소별 누적 PM2.5 시계열을 **좌표 포함**으로 반환
      (`PublicStationSeries(stationName, latitude, longitude, samples[])`,
      `Sample(measuredAt, pm25, pm25Grade)`). 좌표·pm25 있는 측정만 담고, 측정소 대표 좌표는
      최신 측정 좌표 사용. 리포지토리 `findRegionSeries` 네이티브 쿼리(측정소·시각 정렬),
      서비스 `regionSeries`(순차 그룹핑, sido 필수 검증). 기존 이력 서비스·엔티티 재사용
- [x] 프론트 MapPage: `addPublicTimeSeries`(색이 시간에 따라 변하는 원기둥+라벨, 등급색,
      데이터 없는 시간 availability 숨김) 추가. `loadSeries`가 자체 관측 시계열과 공공 실측
      시계열을 함께 로드(한쪽이 비어도 다른 쪽 재생), 동일 Clock/Timeline로 동시 재생
- [x] 백엔드 테스트 128건 통과(신규 서비스 테스트 2건: 측정소별 그룹핑·최신좌표, sido 필수)
- [x] **실 DB 스모크 검증(2026-07-21)**: 누적 832건(2026-07-18~) 위에서
      `series?sido=인천` → 측정소 42곳, 지역 전체 distinct measuredAt 5프레임, 각 측정소
      좌표·pm25·등급 포함. sido 누락 → 400. (네이티브 쿼리는 Phase 11 `@Transactional`
      사례처럼 mock 테스트가 못 잡는 실 DB 결함 가능성이 있어 실기동으로 재확인)

### 함께 수정한 잠복 버그

- [x] `loadCurrent`가 전체 데이터소스를 초기화하면서 airkorea·idwSurface까지 지웠으나
      복구하지 않아, 시계열→현재값 복귀 시 공공/IDW 레이어가 사라지던 문제 수정.
      이제 `loadCurrent`는 자체 레이어(관측·예측·보간)만 초기화하고, airkorea는 mode 변경
      effect가, idwSurface는 sido effect가 각각 복원한다
- [x] (IDW 최종리뷰 Minor #5) 오염물질·기상 변경 시 `/interpolation/grid`가 불필요하게
      재요청되던 문제 → IDW 표면 로드를 `publicAir.sido` 의존 별도 effect로 분리

### 변경 파일

- 신규: `frontend/src/config/sido.ts`,
  `backend/.../publicdata/history/dto/PublicStationSeries.java`
- 백엔드: `PublicDataHistoryController`(series 엔드포인트), `PublicDataHistoryService`
  (`regionSeries`), `PublicAirMeasurementRepository`(`findRegionSeries`),
  `PublicDataHistoryServiceTest`(테스트 2건)
- 프론트: `MapPage.tsx`(시도 드롭다운·`changeSido`·`addPublicTimeSeries`·
  `renderAirkoreaCurrentLayer`·`loadSeries` 확장·effect 정리), `docs/user-guide.html`

### 미완료 / 알려진 제약

- 브라우저 육안 확인 대기(다른 지도 기능과 동일): `/map`에서 시도 전환·시계열 재생 시각 확인
- 시계열 재생 프레임 수는 누적량에 비례 — 현재 3일간 5프레임(스택이 매시간 켜져 있지 않아
  sporadic 수집). 매시간 수집이 지속되면 프레임이 촘촘해진다(코드 결함 아님)

## Phase 14. 프론트엔드 컴포넌트 테스트 도입(3순위 1번) — VERIFIED (2026-07-21)

3순위(품질·운영 보강)의 1번 항목. 백엔드만 검증되던 상태(프론트 테스트 0건)에서 Vitest+RTL을
도입해 순수 함수와 대표 컴포넌트 렌더링을 자동 검증한다.

- [x] 개발 의존성: `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`,
      `@testing-library/dom` 추가. 스크립트 `test`(vitest run)·`test:watch` 추가
- [x] `vitest.config.ts`(별도 설정, jsdom 환경, Cesium 정적복사 플러그인 제외, React JSX 자동주입),
      `src/test/setup.ts`(jest-dom 매처 등록 + afterEach cleanup)
- [x] `tsconfig.app.json`에서 테스트 파일 제외(빌드 `tsc -b`는 테스트를 타입검사하지 않고,
      테스트는 Vitest/esbuild가 처리 — 빌드와 테스트 관심사 분리)
- [x] 테스트 20건: `config/grades`(등급 경계·정렬 7), `config/publicGrades`(오염물질 등급 구간·
      높이 정규화 클램프·색상 7), `config/sido`(AirKorea 17시도 일치·중복없음·좌표범위 4),
      `components/AlertBanner`(경보 렌더·빈 경보 시 미표시 2, apiClient 목)
- [x] 검증: `npm run test` → **20/20 통과**, `npm run build` 무영향(테스트 제외 확인),
      `npm run lint`(oxlint) 무경고
- 참고: AlertBanner의 조회 실패(catch) 경로 테스트는 Vitest의 미처리 거부 추적과 충돌해 제외
      (렌더 로직 2건으로 핵심 동작은 커버). Cesium 의존 컴포넌트(MapPage)는 jsdom에서
      테스트 비용이 커 순수 함수·경량 컴포넌트 우선

### 변경 파일

- 신규: `frontend/vitest.config.ts`, `frontend/src/test/setup.ts`,
  `frontend/src/config/{grades,publicGrades,sido}.test.ts`,
  `frontend/src/components/AlertBanner.test.tsx`
- 수정: `frontend/package.json`(스크립트·devDependencies), `frontend/tsconfig.app.json`(테스트 제외)

## Phase 15. 경보 발령 시도 강조(3순위 2번) — COMPLETED (2026-07-21)

3순위 2번. 착수 전 **경보 데이터의 실제 단위를 확인**한 결과, AirKorea 경보는 시군구가 아니라
`districtName`(시도)와 `moveName`(예보권역, 예: 경기남부권역) 단위로만 온다는 사실을 발견했다.
따라서 "시군구 정밀 폴리곤"은 경보 데이터와 직접 매칭되지 않아(권역→시군구 매핑 근거 데이터가
별도 필요, 임의 생성 금지), 사용자와 재협의해 **데이터 단위에 정확히 일치하는 시도 단위 강조**로
확정했다(외부 데이터 불필요, 즉시 검증 가능).

- [x] 순수 함수 `utils/alerts.ts` `summarizeAlertsByDistrict`: 활성 경보를 시도별로 묶어
      최고 발령단계(경보>주의보)·발령항목(중복제거)·건수 요약, 심각도 내림차순 정렬
- [x] 지도 "경보 권역" 레이어(`alertRegion`): 발령 시도 중심(`SIDO_CENTERS`)에 반투명 원
      (경보 빨강/주의보 주황) + 라벨 + InfoBox. `loadAlerts`가 `/air-quality/alerts/active`
      조회 후 렌더(실패해도 타 레이어 무영향). 레이어 토글 기본 켜짐
- [x] 테스트: `utils/alerts.test.ts` 5건(그룹핑·최고단계·정렬·비활성/무districtName 제외·항목중복)
      포함 프론트 **25건 통과**, `npm run build`·oxlint 무영향
- [x] 실 API 데이터 경로 확인(2026-07-21): `/air-quality/alerts/active` 200,
      `districtName` 값이 `SIDO_CENTERS` 시도명과 일치하는 형식(fixture·스펙 동일 단문명).
      단, **조회 시점 활성 경보 0건**(맑은 날)이라 강조 원 육안 렌더는 경보 발생 시 또는
      Mock 모드에서 확인 대기(다른 지도 시각 기능과 동일한 육안 확인 대기 상태)

### 변경 파일

- 신규: `frontend/src/utils/alerts.ts`, `frontend/src/utils/alerts.test.ts`
- 수정: `frontend/src/config/mapConfig.ts`(alertRegion 색·설정),
  `frontend/src/pages/MapPage.tsx`(alertRegion 레이어·`addAlertRegion`·`loadAlerts`),
  `docs/user-guide.html`(§7 레이어 설명·v1.5)

## Phase 16. 브라우저 육안 확인 + 지도 결함 2건 수정(3순위 3번) — VERIFIED (2026-07-22)

Chrome 확장 연결이 안 되어 **Playwright**(플러그인)로 실 스택에 대해 전 화면을 육안 확인했다.
사용자가 신고한 3D 지도 "요청 처리 중 오류가 발생했습니다"의 원인도 이 과정에서 확정·수정했다.

### 발견·수정한 결함

- [x] **StrictMode 비동기 경합(사용자 신고 오류의 원인)**: React StrictMode(개발 모드)의
      이중 마운트에서, 첫 마운트의 `loadCurrent`가 API 응답 대기 중 Viewer #1이 파괴되고
      응답 도착 후 파괴된 Viewer의 `viewer.clock` 접근 →
      `TypeError: Cannot read properties of undefined (reading 'clock')` → catch가
      일반 메시지("요청 처리 중 오류…")로 표시. 모든 API는 200이라 네트워크 원인이 아님을
      Playwright 콘솔·네트워크 로그로 확정. **수정**: `loadCurrent`/`loadSeries`의 await 후
      `viewerRef.current !== viewer || dataSourcesRef.current !== ds`면 중단하는 stale 가드
      추가(재마운트·언마운트 공통 방어). catch에 `console.error` 로깅도 추가(원인 추적성).
      수정 후 새 마운트에서 오류 메시지·콘솔 에러 0건 확인. ※ 이 버그는 Phase 7부터
      잠복(육안 확인이 없어 미발견) — 시각 검증의 필요성을 보여준 사례
- [x] **OSM 타일 z>19 CORS 콘솔 오류**: 크게 확대 시 OSM이 제공하지 않는 줌 레벨(z20~21)
      타일을 요청해 CORS 오류가 쌓임 → `OpenStreetMapImageryProvider`에 `maximumLevel: 19`
      설정(z19 타일 확대 표시, 기능 영향 없음)

### 육안 확인 결과 (Playwright, 실 스택·실 DB·실 공공 API)

- [x] **Phase 6**: 로그인(admin) → 대시보드(요약 카드 5종·공공 카드 5종·관측vs예측 차트·
      누적 1,038건) · 관측 데이터(1,358건·91페이지·필터·삭제버튼) · 데이터 등록(폼 2종) ·
      AI 예측(폼+최근 예측 이력 5건) · IDW 보간(p 입력·이력) · 모델 성능(회귀 지표 4종·
      등급 정확도·혼동행렬·합성 데이터 경고) · 공공 대기질(올해 경보 이력 실데이터) 렌더 확인
- [x] **Phase 7**: 3D 지도 렌더(OSM), 관측·예측·보간 마커, 공공 측정소 43곳 값+등급 라벨,
      "데이터 없음 △" 처리, 레이어 체크박스 6종, InfoBox 팝업(격자 클릭) 확인
- [x] **Phase 8**: [시계열 로드] → 900x 배속 재생 동작, 시계열 격자(등급색)·시각별 라벨,
      Timeline 이동, [현재값 보기] 복귀 확인
- [x] **Phase 13 신규 기능**: 시도 드롭다운 인천→서울 전환 시 측정소 40곳·기상(24.5℃)
      갱신·IDW 표면 서울 bbox 재계산·카메라 flyTo 확인. 시계열→현재 복귀 시 공공 레이어
      복원(이번 수정 버그) 확인. 공공 기준항목 KHAI 전환 시 라벨 갱신 확인
- [x] **실측 IDW 표면**: 인천(서해 섬 포함 bbox)·서울 모두 등급색 반투명 면 렌더 확인
- 미확인(데이터 사유): 경보 권역 원(활성 경보 0건 — 맑은 날 정상), 대시보드 시간별 차트
      (샘플 시간 경과 — 시연 전 `--airvision.sample.reseed=true` 실행으로 해결, README §3-1),
      대기질 예보(자정 직후 당일 예보 미발표 시간대 — 발표 후 정상 표시 예상)

### 변경 파일

- `frontend/src/pages/MapPage.tsx`(stale 가드 2곳·catch 로깅 2곳·OSM maximumLevel),
  `docs/progress.md`(본 절·Phase 6/7/8/13 승격)

## Phase 17. 지도 초기 뷰 인천 중심 + 전체화면 수정 — VERIFIED (2026-07-22)

사용자 요청 2건: ① 3D 지도 최초 표시를 인천 중심으로, ② 전체화면 버튼을 눌러도
지도 크기가 변하지 않는 문제.

- [x] **초기 카메라**: `mapConfig.ts` `initialView`를 수도권 광역(126.98, 37.2)에서
      기본 시도인 인천 중심(126.7052, 37.4563 — `config/sido.ts` 인천 좌표와 동일)으로 변경
- [x] **전체화면 원인·수정**: Cesium `fullscreenButton`은 `fullscreenElement` 미지정 시
      `document.body`(페이지 전체)를 전체화면 대상으로 삼음 — 브라우저가 이미 최대화면
      화면 변화가 없어 보이는 것이 원인. Viewer 옵션에
      `fullscreenElement: containerRef.current`(지도 컨테이너)를 지정해 지도만 확대되도록 수정
- [x] **Playwright 실검증**: 초기 로드 시 인천 측정소 밀집 지역이 화면 중앙 확인.
      전체화면 클릭 → `document.fullscreenElement === 지도 컨테이너`, 컨테이너 1536x720
      (= 화면 크기, 기존 1264x419) 확인, 사이드바 없이 지도만 표시. `exitFullscreen` 후
      1264x419 레이아웃 크기 복귀 확인
- [x] 프론트 테스트 25/25·빌드·oxlint 통과

### 변경 파일

- `frontend/src/config/mapConfig.ts`(initialView), `frontend/src/pages/MapPage.tsx`
  (fullscreenElement), `docs/user-guide.html`(§7 전체화면·초기 화면 안내, v1.6)

## Phase 18. 잔여 검증 일괄 처리 — VERIFIED (2026-07-22)

앞선 Phase들에서 "대기"로 남겨둔 잔여 항목 3건을 일괄 처리했다.

### ① 경보 권역 육안 검증 (Phase 15 → VERIFIED 승격)

- 실 API 활성 경보가 0건이라 `.env` 수정 없이 **커맨드라인 인자로 강제 Mock 모드** 기동:
  `bootRun --args='--airvision.public-data.mock-enabled=true ...'`
  (수집기 2개 플래그도 꺼서 Mock 데이터가 실측 누적 테이블에 저장되는 것을 방지)
- Playwright 육안 확인: 인천 중심 **주황(주의보) 반투명 원 + "⚠ 인천 초미세먼지 주의보 발령"
  라벨** 렌더, 상단 AlertBanner(발령 농도 82㎍/㎥) 동시 표시, "Mock 데이터" 배지 확인
- Mock 예보 카드(오늘 보통/내일 나쁨/모레 보통) 렌더도 확인 — 실키 모드의 예보
  "데이터 없습니다"가 자정 직후 미발표 시간대 특성임을 뒷받침

### ② 샘플 리시드 실행 (대시보드 시간별 차트 복구)

- 같은 기동에 `--airvision.sample.reseed=true` 포함 → **511개 시간대 보충** 로그 확인
- `GET /api/dashboard/hourly?hours=24` 0→**24포인트**, 대시보드 차트 라인 육안 확인
- 시계열 재생 기본 기간도 현재 시각 기준(7/21~7/22)으로 자동 갱신됨
- 정상(실키) 모드 재기동 후에도 24포인트 유지 확인(mock=false·측정소 43곳 복귀)

### ③ IDW 최종리뷰 Minor 폴리시 잔여 정리

- `PublicIdwServiceTest`에 경계값 테스트 2건 추가: power 0.1/10·resolution 2/20 허용,
  단일 소스(span=0) 시 bbox 최소 여백(±0.05) 확장 — 백엔드 테스트 **130건** 통과
- `MapPage.tsx`: catch의 불필요 optional chain 2곳 제거(리뷰 #6),
  `loadIdwSurface`/`loadAlerts`에도 응답 후 stale 가드 추가(Phase 16 수정과 일관화)
- 프론트 테스트 25건·빌드·oxlint 통과

### 변경 파일

- `backend/src/test/.../PublicIdwServiceTest.java`(테스트 2건),
  `frontend/src/pages/MapPage.tsx`(optional chain 정리·stale 가드), `docs/progress.md`(본 절)

## Phase 19. 최종보고서 정합성 점검 + 인천 핵심 3구 중심화 — VERIFIED (2026-07-22)

기반 문서 `docs/AI 영상인식 기반 3차원 미세먼지정보 통합시스템 시작품 제작_최종보고서.pdf`
(2022, KICT/이안에스아이티, 78쪽)를 전수 확인하고 현재 구현과 비교했다. 아울러 사용자 결정에
따라 **타겟 지역을 인천(핵심: 미추홀구·남동구·연수구)으로 확정**하고 지도·데이터·대시보드를
인천 중심으로 정비했다.

### 보고서 대비 정합성 요약

- 일치(이미 반영): 이미지+기상(온·습·풍속)→PM2.5 회귀 모델과 등급 분류, ROI 지정,
  MAD 이상치 보정, 전이학습 옵션(보고서 결론은 전이학습 무 채택 — 현재 기본값 false와 일치),
  입체격자+시간별 색상 변화(보고서 CZML ↔ 현재 TimeIntervalCollectionProperty, 동일 효과),
  레이어 구분(공공/관측/예측/보간), 객체 클릭 정보 조회, 타임라인 재생, 공공(AirKorea)·기상청
  수집 및 통합 저장소, 로그인·사용자 인증
- 의도된 차이(MVP 결정 유지): ResNet-152 → ResNet18(CLAUDE.md 금지사항: 초기 대형 모델),
  7x7x3 격자 → 3x3x2(성능 확인 후 확장 항목), 3DTiles 지형/건물(고양·안양 원천데이터 전제 —
  대상지가 인천으로 변경되어 원천데이터 없음, MVP 제외 유지), 사용자 그룹 관리(금지사항),
  eGovFrame/JSP → Spring Boot+React(기술 현대화)
- 미반영 격차(추가 기능 후보, 아래 "다음 권장 작업"): Modified IDW(보고서 핵심 보간 알고리즘,
  1·2차 가중치 보정 — 현재는 일반 IDW), 모델 입력 태양고도 추가(보고서 독립변수 4종 중 미반영 1종),
  듀얼맵(예측/보간 vs 관측 비교), 화면 캡처·측정 도구·위성 배경지도 전환

### 인천 핵심 3구 중심화 구현

- [x] `frontend/src/config/sido.ts`: `INCHEON_CORE_DISTRICTS`(미추홀·남동·연수 중심좌표),
      `DISTRICT_VIEW_HEIGHT`(12km), `INCHEON_FOCUS_VIEW`(3구 조망 126.69/37.433/40km) 추가
- [x] `mapConfig.initialView`를 3구 조망으로 변경(160km 광역 → 40km 핵심권), 테스트로
      `INCHEON_FOCUS_VIEW`와 동일성 고정
- [x] MapPage: 인천 선택 시 "핵심 대상지" 구 이동 버튼 3개 표시(보고서의 "사업대상지 지도 이동"
      기능 대응), 시도 드롭다운에서 인천 선택 시 광역 대신 3구 조망으로 flyTo
- [x] V4 마이그레이션: 인천 3구 자체 관측소 6곳(미추홀주안·미추홀용현·남동구월·남동논현·
      연수동춘·연수송도) + 최근 7일 합성 관측값(V2와 동일 생성식, 기존 데이터 무삭제).
      리시더는 전체 관측소 대상이므로 신규 관측소도 이후 리시드에 자동 포함
- [x] 대시보드: 공공 실측 추이 차트를 `sido=인천`으로 고정(제목 "인천 시간별 평균"),
      현재 대기질·예보 카드는 기존 기본 시도(인천) 유지

### 테스트·검증 결과

- 프론트 Vitest **29건 통과**(sido 신규 4건 포함), oxlint 무경고, `npm run build` 통과
- 백엔드 `gradlew test` **BUILD SUCCESSFUL**(130건)
- 실 DB 실기동: V4 적용 후 `GET /api/sites` 13곳(신규 6곳 좌표 확인), 신규 관측소 관측 169건
  (7일×24h+1), `history/measurements/hourly?sido=인천` 6포인트, `viz/observations/latest` 13곳
- Playwright 육안 확인: 초기 화면이 미추홀·남동·연수 조망(신규 격자 6곳 + 공공 측정소 43곳 렌더),
  "핵심 대상지" 버튼 렌더 및 미추홀구 클릭 시 flyTo 확인, 대시보드 "공공 실측 PM2.5 추이
  (인천 시간별 평균)" 데이터 렌더, 콘솔 에러 0건

### 변경 파일

- 신규: `backend/src/main/resources/db/migration/V4__seed_incheon_core_sites.sql`
- 프론트: `config/sido.ts`, `config/sido.test.ts`, `config/mapConfig.ts`,
  `pages/MapPage.tsx`(구 이동 버튼·인천 조망), `pages/DashboardPage.tsx`(인천 고정)
- 문서: `docs/user-guide.html`(§7·업데이트 이력 v1.8), `docs/progress.md`(본 절)

### 다음 권장 작업 (보고서 격차 기반, 우선순위순)

→ **전체 완료(2026-07-22, Phase 20)**: Modified IDW·태양고도·듀얼맵·뷰어 유틸리티 3종

## Phase 20. 최종보고서 격차 기능 4종 구현 — VERIFIED (2026-07-22)

Phase 19에서 식별한 보고서 대비 격차 4건을 우선순위 순서로 모두 구현·검증했다.

### ① Modified IDW (보고서 §4.1.2, 표 3-11)

- [x] `ModifiedIdwInterpolator`: 보고서 7단계 절차(거리→1차 가중치→leave-one-out 1차 보간→
      절대오차→보정값 1+|e|/max|e|→2차 가중치→최종 보간) 구현. 보고서 코드의 결함 2건은
      의도적으로 보정(동일좌표 실측 제외 → 실측 반환, 오차 전부 0 → 일반 IDW 폴백)하고
      Javadoc에 근거 기록. 거리는 기존 `GeoUtils.haversineKm` 재사용(보고서 2차 검증과 동일 방식)
- [x] Python 기준 구현 `scripts/modified_idw_reference.py` 작성, **교차검증 1e-6 이내 일치**
      (보정값 8개·보간값 3개 기대값, Phase 3 IDW와 동일한 검증 방식)
- [x] API 연결: `POST /api/interpolations/run`에 `method`(IDW|MODIFIED_IDW, 기본 IDW) 추가,
      결과 `algorithm` 컬럼에 방법 기록. `GET /api/air-quality/interpolation/grid`에도
      `method` 파라미터 추가(응답에 method 포함, 보정값은 격자 전체에서 1회 계산)
- [x] 프론트: IDW 보간 화면에 "보간 방법" 선택 추가
- [x] 테스트: `ModifiedIdwInterpolatorTest` 7건, 컨트롤러 2건, `PublicIdwServiceTest` 2건 추가
- [x] 실검증: run API 표준 17.4568 vs Modified 17.1615(인천시청), 잘못된 method → 400,
      실 AirKorea 소스 grid 36셀 중 34셀 값 상이, UI 실행 → 이력 알고리즘 MODIFIED_IDW 확인

### ② 태양고도 입력 (보고서 모델 독립변수 4종 완성)

- [x] `app/common/solar.py`: NOAA 근사식(균시차·적위) 태양고도 계산. naive 시각은 KST 규약
- [x] 파이프라인: labels.csv 위경도 컬럼(선택) + `add_solar_altitude` 파생, `EnvScaler`
      컬럼 가변화(scaler.json에 columns 저장, 구버전 파일은 3특징 폴백 — 하위 호환),
      `MultimodalPm25Net` env_dim 가변(config `env_columns`)
- [x] 학습: CLI `--solar` / API `use_solar_altitude`. 추론: 태양고도 모델은 latitude/longitude
      필수(누락 시 400), captured_at 생략 시 현재 시각. Spring은 관측소 좌표+현재 시각을
      항상 multipart로 전달(미사용 모델은 무시 — 기존 모델 하위 호환)
- [x] 샘플 생성기: 인천 핵심 3구 좌표를 관측소별 위경도로 기록
- [x] 테스트: `test_solar.py` 10건 + 태양고도 학습·추론 스모크 3건 → AI 총 **73건 통과**
- [x] 실검증: 데이터셋 재생성(120장) → `resnet18_solar_v1` 학습(env 4차원 확인) →
      Spring 경유 예측 성공(미추홀주안, 좌표·시각 자동 전달), 기존 3특징 모델 병행 동작,
      AI 직접 호출 시 위경도 누락 → 400 + 안내 메시지

### ③ 듀얼맵 (보고서 그림 3-73~75)

- [x] MapPage "듀얼맵" 토글: 좌(관측·공공, 기준) / 우(AI 예측·보간, 비교) 분할.
      우측 뷰어는 좌측 카메라 추종(percentageChanged 0.001 동기화), 직접 조작 차단,
      경량 위젯 구성. 예측/보간 데이터는 loadCurrent와 동일 API로 별도 로드
- [x] 실검증(Playwright): 분할 렌더, 우측에 예측(미추홀주안)·보간 격자만 표시,
      미추홀구 이동 시 양쪽 카메라 동기 이동 확인

### ④ 뷰어 유틸리티 (보고서 §4.3.3 (3))

- [x] **거리 측정**: 좌클릭 지점 추가(점+노란 선+누적 km 라벨), 우클릭 종료, [측정 지우기].
      `utils/geo.ts`(haversineKm·pathDistanceKm, 백엔드 GeoUtils와 동일 규약) + 테스트 5건
- [x] **화면 캡처**: `capture_날짜_시각.png` 다운로드 (보고서 파일명 규약,
      Viewer `preserveDrawingBuffer` 활성화)
- [x] **배경지도 전환**: ion 토큰 존재 시 [위성/일반] 토글(createWorldImagery ↔ OSM),
      토큰 없으면 버튼 미표시
- [x] 실검증(Playwright): 측정 2지점 8.17km 라벨·우클릭 종료, 캡처 다운로드 파일명 확인.
      배경 전환은 ion 토큰 미설정 환경이라 버튼 미표시가 정상 동작(위성 전환은 토큰 설정 후 확인 필요)

### 테스트 결과 종합

- 백엔드 `gradlew test` BUILD SUCCESSFUL(신규 11건 포함), AI `pytest` 73건,
  프론트 `vitest` 34건(신규 geo 5건)·빌드·oxlint 통과
- 실기동: Modified IDW run/grid, 태양고도 모델 Spring 연동, 듀얼맵·측정·캡처 Playwright
  육안 확인 — 콘솔 에러 0건

### 변경 파일

- 백엔드 신규: `interpolation/ModifiedIdwInterpolator.java`, 테스트 1종. 수정:
  `InterpolationRequest`(method)·`InterpolationService`·`PublicIdwService`(+오버로드·검증)·
  `PublicIdwController`·`IdwGridResponse`(method 필드)·`AiServiceClient`(+위치/시각 오버로드)·
  `PredictionService`, 기존 테스트 2종 갱신
- AI 신규: `app/common/solar.py`, `tests/test_solar.py`. 수정: `schema.py`(+add_solar_altitude)·
  `dataset.py`(EnvScaler columns)·`network.py` 주석 그대로·`train.py`·`predict.py`·
  `models_router.py`·`sample/generator.py`(+위경도)·`scripts/train_model.py`(--solar)·
  `tests/test_model.py`(+솔라 스모크)
- 프론트 신규: `utils/geo.ts`·`utils/geo.test.ts`. 수정: `pages/InterpolationPage.tsx`(방법 선택)·
  `pages/MapPage.tsx`(듀얼맵·측정·캡처·배경 전환)
- 스크립트: `scripts/modified_idw_reference.py`(신규)
- 문서: `docs/user-guide.html`(§7·§11·이력 v1.9), `docs/progress.md`(본 절)

### 알려진 제약

- ~~듀얼맵 우측 뷰어는 현재값(최신 예측·보간)만 표시한다~~ → **해결(Phase 21)**: 시계열 이력 재생 지원
- ~~거리 측정 중에도 엔티티 클릭 시 InfoBox가 열릴 수 있다~~ → **해결(Phase 22)**: 측정 중 기본 클릭 억제
- ~~위성 배경 전환은 ion 토큰 미설정으로 미육안검증~~ → **검증 완료(Phase 23)**: 토큰 설정 후 실확인
- `resnet18_solar_v1` 지표는 합성 120장·3 epochs 결과로 파이프라인 검증용이다(성능 인용 금지)

## Phase 21. 듀얼맵 시계열 이력 재생 — VERIFIED (2026-07-22)

Phase 20의 알려진 제약 "듀얼맵 우측 뷰어는 현재값 전용"을 해소했다. [시계열 로드] 시
우측 비교 뷰어가 선택 기간의 **AI 예측·보간 이력**을 좌측 타임라인과 동기 재생한다.

### 구현 내용

- [x] `utils/compareSeries.ts` 신규: 저장된 예측 이력(`/predictions`)을 관측소별로,
      보간 이력(`/interpolations`)을 대상 좌표별로 묶어 기간 필터·시각 정렬한
      시계열(SeriesSite 호환)로 변환. 좌표 미상 관측소·기간 밖 이력은 제외.
      테스트 4건(`compareSeries.test.ts`)
- [x] `addTimeSeriesSite`에 마커 색·구분 텍스트 매개변수 추가(기본값은 기존 관측 시계열과
      동일 — 기존 호출 무영향). 예측은 주황, 보간은 보라 마커로 구분
- [x] 듀얼맵 effect 확장: ① 좌→우 **시계 동기화**(main clock onTick → compare clock),
      ② 시계열 모드면 기간 내 예측·보간 이력을 TimeIntervalCollection 격자로 렌더
      (데이터 없는 시간은 availability로 숨김 — 관측 시계열과 동일 규약),
      현재값 모드면 기존처럼 최신값 렌더. effect 의존성 [dualMode, mode, seriesKey]
      (`seriesKey`는 [시계열 로드] 성공 시 증가 — 기간 변경 재렌더 신호,
      datetime 입력 타이핑마다 뷰어가 재생성되지 않도록 from/to는 의존성에서 제외)
- [x] 우측 상단 라벨에 모드 표시: "최신값" / "이력 재생" · 좌측 카메라·시간 추종

### 테스트·검증 결과

- 프론트 Vitest **38건 통과**(신규 compareSeries 4건), tsc·oxlint·빌드 통과
- Playwright 실검증(실 스택): 듀얼맵 켠 상태에서 [시계열 로드] → 우측 라벨 "이력 재생"
  전환, 타임라인 이동 시 우측에 "미추홀주안 (예측) 80.3㎍/㎥ 매우나쁨" 격자와
  "인천시청 (보간) 17.5㎍/㎥ 보통" 격자가 해당 시각 구간에 표시(같은 시각 중복 예측은
  최신 실행값 우선 — TimeIntervalCollection 규약). [현재값 보기] 복귀 시 라벨 "최신값"
  전환 확인. 콘솔 에러 0건
- 참고: 이력 재생은 기간 안에 예측·보간 실행 이력이 있어야 표시된다(시연 전 AI 예측/보간
  1회 이상 실행 권장)

### 변경 파일

- 신규: `frontend/src/utils/compareSeries.ts`, `frontend/src/utils/compareSeries.test.ts`
- 수정: `frontend/src/pages/MapPage.tsx`(시계 동기화·시계열 분기·seriesKey·라벨),
  `docs/user-guide.html`(§7 듀얼맵·이력 v1.10), `docs/progress.md`(본 절)

## Phase 22. 거리 측정 중 InfoBox 억제 — VERIFIED (2026-07-22)

Phase 20의 알려진 제약 "거리 측정 중에도 엔티티 클릭 시 InfoBox가 열릴 수 있다"를 해소했다.

- [x] 측정 모드 진입 시: 열려 있는 InfoBox를 닫고(`selectedEntity = undefined`),
      뷰어 기본 입력(LEFT_CLICK 엔티티 선택, LEFT_DOUBLE_CLICK 엔티티 추적)을
      `screenSpaceEventHandler`에서 제거해 마커·격자 위를 클릭해도 측정 지점만 추가되게 함
- [x] 측정 종료 시(우클릭/토글 해제/언마운트): 저장해 둔 기본 입력 핸들러를 그대로 복원
      (뷰어가 이미 파괴된 경우 생략)
- [x] 검증: tsc·oxlint·Vitest 38건 통과. Playwright 실검증 — 동일 지점 클릭이
      평상시엔 InfoBox 표시, 측정 중엔 미표시, 우클릭 종료 후엔 다시 표시(복원) 확인.
      콘솔 에러 0건(로그인 전 401 1건은 정상 인증 흐름)

### 변경 파일

- `frontend/src/pages/MapPage.tsx`(측정 effect: 기본 클릭 제거·복원),
  `docs/user-guide.html`(§7·이력 v1.11), `docs/progress.md`(본 절)

## Phase 23. ion 토큰 env 적용 수정 + 듀얼맵 비교 전용 페이지 — VERIFIED (2026-07-22)

사용자 요청 2건: ① Cesium ion 토큰 설정 확인·위성/일반 전환 검증, ② 두 지도가 항상
나타나는 전용 화면 추가.

### ① ion 토큰 env 불일치 수정 (잠복 설정 결함)

- **발견**: 안내 문서는 "루트 `.env`의 `VITE_CESIUM_ION_TOKEN`"이라고 되어 있으나,
  Vite는 기본적으로 앱 루트(`frontend/`)의 env 파일만 읽어 루트 `.env`의 토큰이
  실제로는 프론트에 전달되지 않았다(토큰 없이 OSM 폴백만 써 와서 미발견).
- **수정**: `frontend/vite.config.ts`에 `envDir: '..'` 지정 → 루트 `.env` 하나로 통합.
  `VITE_` 접두사 변수만 클라이언트에 노출되므로 DB 비밀번호 등 비접두사 변수는
  번들에 포함되지 않는다(안전).
- **실검증**(사용자 토큰 설정 후): 지도 최초 로드 시 위성영상(Bing Aerial via ion) 시작,
  [일반 지도] 클릭 → OSM 전환, [위성 지도] 클릭 → 위성 복귀 육안 확인. 콘솔 에러 0건

### ② 듀얼맵 비교 전용 페이지 (/dual-map)

- `MapPage`에 `initialDual` prop 추가(기본 false — 기존 /map 동작 무변경),
  `/dual-map` 라우트 신설(`<MapPage key="dual-map" initialDual />`, key로 /map과 상태 분리),
  사이드바에 "듀얼맵 비교" 메뉴 추가. 기존 듀얼맵 토글·시계열 재생 기능 전부 동일
- 실검증: 메뉴 클릭 → 두 지도(캔버스 2개+비교 뷰)가 켜진 상태로 즉시 시작,
  듀얼맵 버튼 활성 표시, 위성 배경 동시 적용 확인

### 테스트·검증

- tsc·oxlint·Vitest 38건 통과. Playwright 실검증(위 ①·② 전부), 콘솔 에러 0건

### 변경 파일

- `frontend/vite.config.ts`(envDir), `frontend/src/App.tsx`(/dual-map 라우트),
  `frontend/src/components/Layout.tsx`(메뉴), `frontend/src/pages/MapPage.tsx`(initialDual),
  `docs/user-guide.html`(§7 배경지도·듀얼맵 비교 메뉴·이력 v1.12), `docs/progress.md`(본 절)

## Phase 24. 듀얼맵 비교 메뉴 제거 — VERIFIED (2026-07-22)

사용자 결정: 3D 지도 화면의 [듀얼맵] 토글로 충분해 전용 메뉴는 불필요.
Phase 23의 ② 항목만 되돌렸다(① ion 토큰 envDir 수정은 유지).

- [x] `/dual-map` 라우트·"듀얼맵 비교" 사이드바 메뉴 제거,
      `MapPage`의 `initialDual` prop 제거(도입 전 시그니처로 복원)
- [x] 지도 화면의 [듀얼맵] 토글·시계열 비교 재생 기능은 그대로 유지
- [x] 검증: tsc·oxlint·Vitest 38건·빌드 통과 (제거 변경이라 실기동 검증은 생략,
      /map 기능은 무변경)

### 변경 파일

- `frontend/src/App.tsx`, `frontend/src/components/Layout.tsx`,
  `frontend/src/pages/MapPage.tsx`, `docs/user-guide.html`(§7·이력 v1.13),
  `docs/progress.md`(본 절)

## Phase 25. 대시보드 지역 선택 (인천 전역·핵심 3구 필터) — VERIFIED (2026-07-22)

사용자 요청: 대시보드가 어느 지역 기준인지 불명확 → 지역(인천 전역 또는
미추홀·남동·연수구)을 선택해 대시보드 내용을 확인할 수 있도록 개선.
설계: `docs/superpowers/specs/2026-07-22-dashboard-region-filter-design.md`,
계획: `docs/superpowers/plans/2026-07-22-dashboard-region-filter.md`

- [x] DB: Flyway `V5__site_district.sql` — `observation_sites.district VARCHAR(30)` 추가,
      핵심 3구 시드 6곳 + V2 인천송도(연수구)에 구 값 채움 (그 외 NULL → 필터 제외)
- [x] 백엔드: `Districts`(허용 3구 검증, 그 외 400) 신설.
      `GET /dashboard/summary`·`/dashboard/hourly`·`/predictions`에 선택적 `district`
      파라미터 추가(미지정 시 기존과 동일). summary 응답에 `district` 키 추가.
      보간(IDW) 건수는 전체 관측소 기반 표면이라 구 단위 분리 불가 → 항상 전체 기준
- [x] 프론트: `RegionSelector` 세그먼트 버튼(인천 전역/미추홀구/남동구/연수구) 신설,
      `DashboardPage`가 선택 구 기준으로 요약·시간별·예측 재조회, 제목에 "OO 기준" 표시.
      공공 데이터 카드·추이는 시/도 단위 자료라 필터하지 않고
      "인천 전역 (시/도 단위 자료)" 라벨 명시, 보간 카드는 구 선택 시 "전체 기준" 표시
- [x] 테스트: 백엔드 Gradle 전체 통과(DashboardControllerTest 4·DistrictsTest 3·
      PredictionControllerTest 2건 신규 포함), 프론트 tsc·빌드·Vitest 41건(신규 3) 통과
- [x] 실검증: 백엔드 기동 → Flyway v5 적용 로그 확인. curl —
      `summary?district=미추홀구` → siteCount 2·평균 38.3, 무파라미터 → siteCount 13·평균 22.8,
      `hourly?district=연수구` → 14행, `district=강남구` → 400 + 허용 목록 메시지.
      Playwright 화면 검증 — 버튼 4개 렌더, 미추홀구 클릭 시 카드·차트 갱신("미추홀구 기준"),
      공공 카드 불변, 인천 전역 복귀 정상

### 변경 파일

- `backend/.../db/migration/V5__site_district.sql`(신규),
  `backend/.../site/ObservationSite.java`·`dto/SiteResponse.java`·`ObservationSiteRepository.java`·
  `Districts.java`(신규), `backend/.../observation/ObservationRepository.java`,
  `backend/.../prediction/PredictionRepository.java`·`PredictionService.java`·`PredictionController.java`,
  `backend/.../dashboard/DashboardService.java`·`DashboardController.java`,
  테스트: `DashboardControllerTest`(신규)·`DistrictsTest`(신규)·`SiteControllerTest`·`PredictionControllerTest`,
  `frontend/src/components/RegionSelector.tsx`(신규)·`RegionSelector.test.tsx`(신규),
  `frontend/src/api/client.ts`, `frontend/src/pages/DashboardPage.tsx`,
  `docs/user-guide.html`(§ 대시보드·이력 v1.14), `docs/progress.md`(본 절)
