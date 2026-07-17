# 원격 PostgreSQL 초기 설정

백엔드를 연결하기 전에 원격 PostgreSQL 서버에서 아래를 1회 수행한다.

## 1. 데이터베이스와 계정 생성 (관리자 계정으로)

```sql
CREATE USER airvision WITH PASSWORD '<비밀번호>';
CREATE DATABASE airvision OWNER airvision;
```

## 2. PostGIS 확장 활성화 (해당 DB에서, 관리자 권한 필요)

```bash
psql -h <호스트> -U <관리자계정> -d airvision -f 01-enable-postgis.sql
```

또는 SQL 직접 실행:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

## 3. 접속 정보 등록

프로젝트 루트의 `.env` 파일에 접속 정보를 입력한다 (`.env.example` 참고).

```
POSTGRES_HOST=<원격 서버 주소>
POSTGRES_PORT=5432
POSTGRES_DB=airvision
POSTGRES_USER=airvision
POSTGRES_PASSWORD=<비밀번호>
```

테이블 생성(스키마 마이그레이션)은 백엔드 최초 기동 시 Flyway가 자동 수행하므로
수동으로 실행할 필요가 없다.
