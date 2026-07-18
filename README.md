# AirVision 3D

AI 영상인식 기반 미세먼지 예측 및 3차원 시각화 시스템 (대학 캡스톤디자인 프로젝트)

대기 이미지와 환경데이터(온도·습도·풍속)로 PM2.5 농도를 예측하고,
**관측값 · AI 예측값 · IDW 보간값**을 CesiumJS 기반 3차원 지도에서 비교·시각화한다.
AirKorea 실시간 대기질·예보·경보와 기상청 기상 데이터를 연동하며
(공공데이터포털 키가 없으면 내장 Mock 데이터로 동작), AI 추정값과 공공 실측값을 비교한다.

> 대기질 데이터: 환경부·한국환경공단 AirKorea · 기상 데이터: 기상청

## 기술 스택

| 구성 | 기술 |
|---|---|
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 4, Zustand, CesiumJS |
| Backend | Spring Boot 4.1, Java 21, Gradle |
| AI Service | FastAPI, Python 3.11, PyTorch (Phase 4~) |
| Database | 원격 PostgreSQL 16 + PostGIS 3.4, Flyway |

## 저장소 구조

```
airvision-3d/
├─ frontend/        # React SPA (대시보드, Cesium 3D 지도)
├─ backend/         # Spring Boot API (인증, 데이터 관리, IDW, 시각화 데이터)
├─ ai-service/      # FastAPI (이미지 전처리, AI 학습·추론)
├─ database/        # DB 초기 설정 스크립트, ERD 문서
├─ data/            # raw / processed / sample / models (Git 미포함)
├─ docs/            # 설계 문서, 구현 계획, 진행 상황
└─ scripts/         # 유틸리티 스크립트
```

## 사전 요구사항

- Java 21
- Node.js 20 이상
- Python 3.11
- 접속 가능한 PostgreSQL 16 + PostGIS (원격 또는 로컬 설치)
- Git

## 빠른 시작

### 1. 데이터베이스 준비 (최초 1회)

원격 PostgreSQL 서버에서 DB 생성과 PostGIS 확장을 활성화한다.
자세한 절차: [database/setup/README.md](database/setup/README.md)

### 2. 환경변수 설정 — ★ DB 접속 정보 입력 위치

```powershell
# Windows (PowerShell)
Copy-Item .env.example .env
# Ubuntu
cp .env.example .env
```

루트의 `.env`에 원격 DB 접속 정보를 입력한다.

```
POSTGRES_HOST=<원격 서버 주소>
POSTGRES_PORT=5432
POSTGRES_DB=airvision
POSTGRES_USER=airvision
POSTGRES_PASSWORD=<비밀번호>
```

백엔드가 기동 시 루트 `.env`를 자동으로 읽으며, 테이블 생성은 Flyway가 자동 수행한다.
`.env`는 커밋하지 않는다.

### 3. 서비스 실행

**통합 실행 (권장, Windows)**

```powershell
.\run.ps1          # backend + ai-service + frontend를 각각 별도 창으로 실행
.\run.ps1 -Stop    # 전체 종료
# 실행 정책 오류 시: powershell -ExecutionPolicy Bypass -File .\run.ps1
```

최초 실행 시 ai-service 가상환경과 frontend 의존성을 자동으로 설치한다.

**개별 실행**

**Backend** (DB 연결 필요)

```bash
cd backend
./gradlew bootRun        # Windows: .\gradlew.bat bootRun
# 확인: http://localhost:8080/api/health
# Swagger: http://localhost:8080/swagger-ui.html
```

**AI Service**

```bash
cd ai-service
python -m venv .venv
.venv\Scripts\activate    # Ubuntu: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --port 8000
# 확인: http://localhost:8000/health (Swagger: /docs)
```

**Frontend**

```bash
cd frontend
npm install
npm run dev
# 확인: http://localhost:5173
```

### 4. 기본 계정

백엔드 최초 기동 시 users 테이블이 비어 있으면 자동 생성된다.

| 아이디 | 비밀번호(기본값) | 역할 |
|---|---|---|
| admin | admin1234! | 관리자 (등록·예측·보간·삭제) |
| user | user1234! | 일반 사용자 (조회) |

비밀번호는 `.env`의 `ADMIN_INIT_PASSWORD` / `USER_INIT_PASSWORD`로 변경할 수 있다.

## 테스트

```bash
# Backend (DB 없이 실행 가능한 단위/슬라이스 테스트)
cd backend && ./gradlew test

# AI Service
cd ai-service && .venv\Scripts\python -m pytest

# Frontend (빌드 + 타입 검사)
cd frontend && npm run build
```

## API 공통 응답 형식

```json
{
  "success": true,
  "data": {},
  "message": null,
  "timestamp": "ISO-8601"
}
```

## 통합 테스트

전체 스택 실행 상태에서 29개 항목을 자동 검증한다.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\integration-test.ps1
```

## 문서

| 문서 | 내용 |
|---|---|
| [user-guide.html](docs/user-guide.html) | **사용 설명서** (처음 사용하는 사람용, 브라우저로 열기) |
| [runtime-requirements.md](docs/runtime-requirements.md) | 실행에 필요한 정보 정리 (DB·환경변수·포트·계정·준비 상태) |
| [public-data-api-integration.md](docs/public-data-api-integration.md) | 공공 API(AirKorea·기상청) 연동 — 키 발급, Mock 모드, 내부 API, 캐시·유효성 정책 |
| [requirements.md](docs/requirements.md) | 요구사항 정의와 구현 현황 |
| [architecture.md](docs/architecture.md) | 시스템 아키텍처·설계 결정 |
| [database-design.md](docs/database-design.md) | ERD·스키마 설계 |
| [api-spec.md](docs/api-spec.md) | API 명세 (등급 기준 포함) |
| [ai-model-design.md](docs/ai-model-design.md) | AI 모델·데이터 파이프라인 설계 |
| [idw-algorithm.md](docs/idw-algorithm.md) | IDW 알고리즘·교차검증 결과 |
| [ui-screen-spec.md](docs/ui-screen-spec.md) | 화면설계서 |
| [test-plan.md](docs/test-plan.md) | 테스트 계획·결과 |
| [deployment.md](docs/deployment.md) | 설치·배포 매뉴얼·문제 해결 |
| [demo-scenario.md](docs/demo-scenario.md) | 발표 시연 시나리오 |
| [capstone-report-outline.md](docs/capstone-report-outline.md) | 결과보고서 목차 |
| [implementation-plan.md](docs/implementation-plan.md) / [progress.md](docs/progress.md) | 구현 계획 / 진행 상황 |
| [CLAUDE.md](CLAUDE.md) | 작업 규칙 |
