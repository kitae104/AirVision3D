# AirVision 3D 진행 상황

> 상태 정의: NOT_STARTED / IN_PROGRESS / BLOCKED / COMPLETED(코드 작성 완료) / VERIFIED(실행·테스트 성공 확인)
> 갱신 규칙: 각 작업 완료 시 본 문서를 갱신한다. 테스트를 실행하지 못한 경우 사유를 기록한다.

최종 갱신: 2026-07-17

## Phase 요약

| Phase | 내용 | 상태 | 비고 |
|---|---|---|---|
| 0 | 저장소 분석과 계획 | VERIFIED | 계획 사용자 승인 완료 |
| 1 | 프로젝트 기반 구축 | VERIFIED | Docker 제외 결정(2026-07-17)으로 잔여 항목 소멸. 전 항목 로컬 검증 완료 |
| 2 | 데이터베이스 및 샘플 데이터 | IN_PROGRESS | 코드 작성·슬라이스 테스트 완료. 실 DB 검증은 원격 DB 접속 정보 대기 |
| 3 | IDW 보간 | NOT_STARTED | |
| 4 | AI 데이터 파이프라인 | NOT_STARTED | |
| 5 | AI 모델 학습과 추론 | NOT_STARTED | |
| 6 | 웹 대시보드 | NOT_STARTED | |
| 7 | CesiumJS 지도 | NOT_STARTED | |
| 8 | 시계열 시각화 | NOT_STARTED | |
| 9 | 통합 테스트와 배포 | NOT_STARTED | |

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
- [ ] 실 DB 검증 — **BLOCKED: 원격 PostgreSQL 접속 정보 대기.**
      정보 등록 후 검증 항목: ① bootRun 시 Flyway V1·V2 적용 ② GET /api/sites 로 샘플 관측소 7곳 조회
      ③ GET /api/sites/{id} 의 geomWkt(PostGIS) 확인 ④ 관측값 CRUD 왕복 ⑤ Swagger UI 접근
- [ ] 사용자 인증(JWT), CSV 업로드 — 4주차 범위 (별도 진행)

### 참고

- 백엔드는 이제 기동 시 DB 연결이 필수다(JPA+Flyway). DB 없이 실행하면 기동 실패가 정상 동작이다.
- 스키마 삭제 시 `AirvisionBackendApplicationTests`(전체 컨텍스트 로드 테스트)는 DB 필요로 제거함.
  DB 확보 후 통합 테스트로 재도입 예정.

## Phase 3 이후

implementation-plan.md 7절의 단계별 완료 조건을 따른다. 착수 시 본 문서에 상세 항목을 추가한다.

## 확인 대기 사항 (BLOCKED 아님, 기본 가정으로 진행 가능)

| # | 질문 | 기본 가정 |
|---|---|---|
| 1 | 실제 라벨링 데이터 확보 가능 여부 | 합성 샘플 데이터로 파이프라인 우선 검증 |
| 2 | GPU 사용 가능 여부 | CPU 기준 설계 |
| 3 | Cesium ion 토큰 | OSM imagery 폴백 |
| 4 | 배포 대상 | 로컬 Docker Compose 시연 |
| 5 | 팀 숙련도 | 역할별 균등 분담 |
