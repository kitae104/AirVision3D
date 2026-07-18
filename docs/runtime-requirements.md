# 시스템 실행 필요 정보 정리

AirVision 3D를 실제로 동작시키기 위해 **확보·설정해야 하는 정보**를 한 곳에 정리한 문서.
처음 세팅하는 PC 기준으로 작성했으며, 절차 중심 안내는 [user-guide.html](user-guide.html)과
[deployment.md](deployment.md)를 참고한다.

## 1. 한눈에 보는 체크리스트

| # | 필요한 것 | 어디에 쓰이나 | 필수 여부 |
|---|---|---|---|
| 1 | Java 21 / Node.js 20+ / Python 3.11 / Git | 3개 서비스 실행 | 필수 |
| 2 | PostgreSQL 접속 정보 5개 (주소·포트·DB명·계정·비밀번호) | 백엔드 → DB 연결 (`.env`) | 필수 |
| 3 | DB 서버의 PostGIS 확장 (또는 확장 생성 권한) | 공간 좌표 컬럼 생성 | 필수 |
| 4 | DB 포트 방화벽 개방 (내 PC → DB 서버) | DB 연결 | 필수 |
| 5 | JWT_SECRET (32바이트 이상 무작위 문자열) | 로그인 토큰 서명 | 필수 (예시값 교체) |
| 6 | 인터넷 연결 | 최초 의존성 설치, 3D 지도 타일 | 필수 |
| 7 | 학습된 AI 모델 (`data/models/`) | AI 예측·모델 성능 화면 | 예측 기능 사용 시 |
| 8 | 기본 계정 비밀번호 변경값 | admin/user 로그인 | 선택 (기본값 있음) |
| 9 | Cesium ion 토큰 | 고품질 지도 영상 | 선택 (없으면 OSM) |

## 2. 필수 소프트웨어

| 프로그램 | 버전 | 확인 명령 |
|---|---|---|
| Java (Temurin/Oracle) | 21 | `java -version` |
| Node.js | 20 이상 | `node -v` |
| Python | 3.11 | `python --version` |
| Git | 최신 | `git --version` |

Docker는 사용하지 않는다 (2026-07-17 결정). 서비스는 로컬 프로세스로 직접 실행한다.

## 3. 외부에서 확보해야 하는 정보 — 데이터베이스

원격(또는 로컬) **PostgreSQL 16 + PostGIS 3.4** 서버가 필요하다.
DB 관리자에게 다음을 요청한다.

| 항목 | 설명 | `.env` 키 |
|---|---|---|
| 서버 주소 | IP 또는 도메인 | `POSTGRES_HOST` |
| 포트 | PostgreSQL 포트 | `POSTGRES_PORT` |
| DB 이름 | 전용 데이터베이스 (예: `airvision`) | `POSTGRES_DB` |
| 계정 / 비밀번호 | 해당 DB의 소유자 권한 권장 | `POSTGRES_USER` / `POSTGRES_PASSWORD` |

추가 확인 사항:

- **PostGIS**: DB에 `CREATE EXTENSION postgis;`가 실행되어 있거나, 계정에 확장 생성 권한이 있어야 한다.
  (권한이 있으면 최초 기동 시 마이그레이션이 자동 시도한다)
- **방화벽**: 내 PC에서 DB 포트로 접속 가능해야 한다.
  확인: `Test-NetConnection <서버주소> -Port <포트>` → `TcpTestSucceeded : True`
- 테이블 생성과 샘플 데이터(관측소 7곳 + 7일치 시간별 관측값)는 백엔드 최초 기동 시
  Flyway가 **자동 수행**하므로 별도 SQL 작업이 필요 없다.

## 4. 환경변수 (`.env`) 전체 항목

루트에서 `Copy-Item .env.example .env` 후 값을 채운다. **`.env`는 절대 커밋하지 않는다.**

| 키 | 필수 | 기본값 | 설명 |
|---|---|---|---|
| `POSTGRES_HOST` | ✅ | - | DB 서버 주소 |
| `POSTGRES_PORT` | ✅ | 5432 | DB 포트 |
| `POSTGRES_DB` | ✅ | airvision | DB 이름 |
| `POSTGRES_USER` | ✅ | - | DB 계정 |
| `POSTGRES_PASSWORD` | ✅ | - | DB 비밀번호 |
| `JWT_SECRET` | ✅ | 예시값 | **32바이트 이상 무작위 문자열로 교체** (미교체 시에도 동작은 하나 보안상 반드시 변경) |
| `BACKEND_PORT` | | 8080 | 백엔드 포트 |
| `AI_SERVICE_URL` | | http://localhost:8000 | 백엔드 → AI 서비스 주소 |
| `AI_SERVICE_PORT` | | 8000 | AI 서비스 포트 |
| `DATA_DIR` | | ./data | AI 데이터/모델 저장 루트 |
| `ADMIN_INIT_PASSWORD` | | admin1234! | 최초 생성 admin 비밀번호 |
| `USER_INIT_PASSWORD` | | user1234! | 최초 생성 user 비밀번호 |
| `FRONTEND_PORT` | | 5173 | 프론트엔드 개발 서버 포트 |
| `VITE_API_BASE_URL` | | http://localhost:8080/api | 브라우저 → 백엔드 주소 |
| `VITE_AI_SERVICE_URL` | | http://localhost:8000 | 브라우저 → AI 서비스 주소 (표시용) |
| `VITE_CESIUM_ION_TOKEN` | | (빈 값) | Cesium ion 토큰. 없으면 OSM 지도로 자동 대체 |

JWT_SECRET 무작위 값 생성 예 (PowerShell):

```powershell
-join ((48..57)+(65..90)+(97..122) | Get-Random -Count 48 | ForEach-Object {[char]$_})
```

## 5. 사용 포트

아래 포트가 다른 프로그램에 점유되어 있지 않아야 한다.

| 포트 | 용도 | 충돌 확인 |
|---|---|---|
| 8080 | Backend (Spring Boot) | `netstat -ano \| findstr :8080` |
| 8000 | AI Service (FastAPI) | `netstat -ano \| findstr :8000` |
| 5173 | Frontend (Vite) | `netstat -ano \| findstr :5173` |
| (DB 포트) | 원격 PostgreSQL (아웃바운드) | `Test-NetConnection` |

## 6. 로그인 계정

백엔드 최초 기동 시 users 테이블이 비어 있으면 자동 생성된다.

| 아이디 | 비밀번호 | 역할 |
|---|---|---|
| admin | `ADMIN_INIT_PASSWORD` (기본 admin1234!) | 관리자 — 등록·삭제·AI 예측·보간 실행 |
| user | `USER_INIT_PASSWORD` (기본 user1234!) | 일반 — 조회 전용 |

시연·운영 환경에서는 `.env`로 기본 비밀번호를 변경할 것을 권장한다.

## 7. 네트워크 요구사항

| 대상 | 언제 필요한가 |
|---|---|
| 인터넷 (npm·PyPI·Gradle 저장소) | **최초 실행 시** 의존성 자동 설치 |
| 인터넷 (지도 타일 서버) | 3D 지도 화면을 열 때마다 (OSM 또는 Cesium ion) |
| DB 서버 포트 | 백엔드 실행 중 상시 |
| localhost 8080/8000/5173 | 서비스 간·브라우저 통신 (외부 개방 불필요) |

## 8. 데이터·모델 준비

| 항목 | 준비 방법 | 없으면 |
|---|---|---|
| 관측소·관측값 샘플 | 백엔드 최초 기동 시 Flyway 자동 시드 | - |
| 합성 대기 이미지 + 라벨 | `ai-service> .venv\Scripts\python scripts\generate_sample_dataset.py` | 예측용 업로드 이미지가 없음 |
| AI 모델 | `ai-service> .venv\Scripts\python scripts\train_model.py --epochs 5` (CPU 약 2분) | AI 예측 시 400 "모델을 찾을 수 없습니다" |

모델·데이터셋은 Git에 포함되지 않으므로 **새 PC마다 위 2개 스크립트를 한 번 실행**해야 한다.

## 9. 실행 명령 요약

```powershell
# 전체 실행 (최초 실행 시 의존성 자동 설치)
.\run.ps1
# 실행 정책 오류 시
powershell -ExecutionPolicy Bypass -File .\run.ps1
# 전체 종료
.\run.ps1 -Stop
# 전체 자동 점검 (29건)
powershell -ExecutionPolicy Bypass -File .\scripts\integration-test.ps1
```

정상 확인: 웹 http://localhost:5173 · 백엔드 http://localhost:8080/api/health · AI http://localhost:8000/health

## 10. 현재 개발 PC 준비 상태 (2026-07-18 기준)

| 항목 | 상태 |
|---|---|
| `.env` (DB 접속 정보 포함) | ✅ 입력 완료 (값은 보안상 이 문서에 기록하지 않음) |
| 원격 PostgreSQL + PostGIS | ✅ 연결·마이그레이션·샘플 시드 완료 |
| 합성 데이터셋 (`data/sample/dataset/`) | ✅ 생성됨 (이미지 120장 + labels.csv) |
| AI 모델 (`data/models/resnet18_multimodal_v1/`) | ✅ 학습됨 (합성 데이터 기준, 파이프라인 검증용) |
| 통합 테스트 | ✅ 29 PASS / 0 FAIL (2026-07-18) |

즉, **이 PC에서는 `.\run.ps1` 한 번으로 바로 실행 가능**하다.
다른 PC로 옮길 때는 1~8장의 정보를 새로 준비해야 한다.
