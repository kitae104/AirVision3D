# 설치 및 배포 매뉴얼

## 1. 요구 환경

| 구분 | 요구사항 |
|---|---|
| OS | Windows 10/11 (개발 검증 완료) 또는 Ubuntu 22.04+ |
| Java | 21 (Temurin/Oracle) |
| Node.js | 20 이상 |
| Python | 3.11 |
| DB | 접속 가능한 PostgreSQL 16 + PostGIS 3.4 (원격/로컬) |

## 2. 데이터베이스 준비 (최초 1회)

`database/setup/README.md` 절차:

```sql
CREATE USER airvision WITH PASSWORD '<비밀번호>';
CREATE DATABASE airvision OWNER airvision;
-- airvision DB에서 (권한 필요; V1 마이그레이션이 자동 시도하므로 계정에 권한이 있으면 생략 가능)
CREATE EXTENSION IF NOT EXISTS postgis;
```

테이블·샘플 데이터는 백엔드 최초 기동 시 Flyway가 자동 생성한다.

## 3. 환경변수

```powershell
Copy-Item .env.example .env
```

| 키 | 설명 |
|---|---|
| POSTGRES_HOST/PORT/DB/USER/PASSWORD | 원격 DB 접속 정보 (필수) |
| JWT_SECRET | 32바이트 이상 무작위 문자열 (운영 시 필수 교체) |
| ADMIN_INIT_PASSWORD / USER_INIT_PASSWORD | 기본 계정 비밀번호 (선택) |
| VITE_CESIUM_ION_TOKEN | Cesium ion 토큰 (선택, 없으면 OSM 지도) |

## 4. 실행

### Windows (권장)

```powershell
.\run.ps1          # 3개 서비스 일괄 실행 (최초 실행 시 의존성 자동 설치)
.\run.ps1 -Stop    # 일괄 종료
```

### 수동 실행 (Windows/Ubuntu 공통)

```bash
# Backend
cd backend && ./gradlew bootRun
# AI Service
cd ai-service && python -m venv .venv && . .venv/bin/activate \
  && pip install -r requirements.txt && uvicorn app.main:app --port 8000
# Frontend
cd frontend && npm install && npm run dev
```

## 5. 초기 데이터/모델 준비

```powershell
cd ai-service
.venv\Scripts\python scripts\generate_sample_dataset.py   # 합성 이미지 120장 + labels.csv
.venv\Scripts\python scripts\train_model.py --epochs 5    # 샘플 모델 학습 (~2분, CPU)
```

## 6. 검증

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\integration-test.ps1   # 29건 자동 검증
```

## 7. 운영 배포 시 추가 고려 (현재 범위 외)

- frontend: `npm run build` 후 dist/를 nginx 등으로 정적 서빙 (+ /api 리버스 프록시)
- backend: `gradlew bootJar` 산출물 `build/libs/*.jar`를 systemd 서비스로 등록
- ai-service: `uvicorn --workers` 또는 gunicorn, 모델 디렉터리 볼륨 관리
- HTTPS, JWT_SECRET 교체, DB 방화벽/계정 최소 권한, CORS 허용 출처 교체

## 8. 문제 해결

| 증상 | 원인/조치 |
|---|---|
| 백엔드 기동 실패: geometry does not exist | PostGIS 미설치 → 관리자로 CREATE EXTENSION postgis |
| 백엔드 기동 실패: 연결 오류 | .env 접속 정보·방화벽 확인 (Test-NetConnection <host> -Port <port>) |
| 예측 502 | ai-service 미기동 → run.ps1 또는 uvicorn 실행 |
| 예측 400 "모델을 찾을 수 없습니다" | 모델 미학습 → train_model.py 실행 |
| run.ps1 파싱 오류 | 스크립트는 UTF-8 BOM이어야 함 (저장 시 인코딩 확인) |
| 기동 직후 로그인 401 | 기본 계정 생성이 헬스체크보다 ~1초 늦음 → 잠시 후 재시도 |
