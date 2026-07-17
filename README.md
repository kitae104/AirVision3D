# AirVision 3D

AI 영상인식 기반 미세먼지 예측 및 3차원 시각화 시스템 (대학 캡스톤디자인 프로젝트)

대기 이미지와 환경데이터(온도·습도·풍속)로 PM2.5 농도를 예측하고,
**관측값 · AI 예측값 · IDW 보간값**을 CesiumJS 기반 3차원 지도에서 비교·시각화한다.

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

## 문서

- [구현 계획](docs/implementation-plan.md)
- [진행 상황](docs/progress.md)
- [DB 초기 설정](database/setup/README.md)
- 작업 규칙: [CLAUDE.md](CLAUDE.md)
