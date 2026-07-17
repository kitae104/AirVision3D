# =====================================================================
# AirVision 3D 통합 실행 스크립트 (Windows PowerShell 5.1+)
#
# 사용법:
#   .\run.ps1          # backend + ai-service + frontend 실행
#   .\run.ps1 -Stop    # 실행 중인 서비스 모두 종료
#
# 실행 정책 오류 시:
#   powershell -ExecutionPolicy Bypass -File .\run.ps1
# =====================================================================
param(
    [switch]$Stop
)

$ErrorActionPreference = "Continue"
$root = $PSScriptRoot

function Stop-Services {
    Write-Host "서비스 종료 중..." -ForegroundColor Yellow
    # backend (gradle/java)
    Get-CimInstance Win32_Process -Filter "Name='java.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -like "*AirVision3D*" -or $_.CommandLine -like "*airvision*" } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    # ai-service (uvicorn)
    Get-CimInstance Win32_Process -Filter "Name='python.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -like "*uvicorn*" -and $_.CommandLine -like "*app.main*" } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    # frontend (vite)
    Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -like "*vite*" -and $_.CommandLine -like "*AirVision3D*" } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Write-Host "종료 완료" -ForegroundColor Green
}

if ($Stop) {
    Stop-Services
    exit 0
}

# --- 사전 점검 ---------------------------------------------------------
Write-Host "`n=== AirVision 3D 실행 준비 ===" -ForegroundColor Cyan

if (-not (Test-Path "$root\.env")) {
    Write-Host "[오류] 루트에 .env 파일이 없습니다." -ForegroundColor Red
    Write-Host "       Copy-Item .env.example .env 후 DB 접속 정보를 입력하세요."
    exit 1
}

# ai-service 가상환경 준비
if (-not (Test-Path "$root\ai-service\.venv\Scripts\python.exe")) {
    Write-Host "[준비] ai-service 가상환경 생성 및 의존성 설치 (수 분 소요)..." -ForegroundColor Yellow
    Push-Location "$root\ai-service"
    python -m venv .venv
    .\.venv\Scripts\python.exe -m pip install -q --upgrade pip
    .\.venv\Scripts\python.exe -m pip install -q -r requirements.txt
    Pop-Location
}

# frontend 의존성 준비
if (-not (Test-Path "$root\frontend\node_modules")) {
    Write-Host "[준비] frontend 의존성 설치..." -ForegroundColor Yellow
    Push-Location "$root\frontend"
    npm install
    Pop-Location
}

# --- 서비스 실행 (각각 별도 창) ----------------------------------------
Write-Host "`n=== 서비스 실행 ===" -ForegroundColor Cyan

Write-Host "[1/3] Backend (Spring Boot :8080) 시작..."
Start-Process powershell -ArgumentList "-NoExit", "-Command",
    "`$Host.UI.RawUI.WindowTitle='AirVision Backend'; Set-Location '$root\backend'; .\gradlew.bat bootRun"

Write-Host "[2/3] AI Service (FastAPI :8000) 시작..."
Start-Process powershell -ArgumentList "-NoExit", "-Command",
    "`$Host.UI.RawUI.WindowTitle='AirVision AI'; Set-Location '$root\ai-service'; .\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000"

Write-Host "[3/3] Frontend (Vite :5173) 시작..."
Start-Process powershell -ArgumentList "-NoExit", "-Command",
    "`$Host.UI.RawUI.WindowTitle='AirVision Frontend'; Set-Location '$root\frontend'; npm run dev"

# --- 헬스체크 대기 -----------------------------------------------------
Write-Host "`n서비스 기동 대기 중 (백엔드는 DB 연결·마이그레이션 때문에 오래 걸릴 수 있음)..."

function Wait-Health {
    param([string]$Name, [string]$Url, [int]$TimeoutSec = 120)
    for ($i = 0; $i -lt $TimeoutSec; $i += 2) {
        try {
            Invoke-RestMethod -Uri $Url -TimeoutSec 2 -ErrorAction Stop | Out-Null
            Write-Host ("  {0,-12} OK   {1}" -f $Name, $Url) -ForegroundColor Green
            return $true
        } catch { Start-Sleep -Seconds 2 }
    }
    Write-Host ("  {0,-12} 실패 {1} (창의 로그를 확인하세요)" -f $Name, $Url) -ForegroundColor Red
    return $false
}

$ai = Wait-Health "AI Service" "http://127.0.0.1:8000/health" 60
$fe = Wait-Health "Frontend" "http://127.0.0.1:5173" 60
$be = Wait-Health "Backend" "http://127.0.0.1:8080/api/health" 180

# --- 안내 --------------------------------------------------------------
Write-Host "`n=== 실행 결과 ===" -ForegroundColor Cyan
Write-Host "  웹 화면   : http://localhost:5173"
Write-Host "  Backend   : http://localhost:8080/api/health (Swagger: /swagger-ui.html)"
Write-Host "  AI Service: http://localhost:8000/health (Swagger: /docs)"
Write-Host ""
Write-Host "  기본 계정 : admin / admin1234!  (관리자)"
Write-Host "              user  / user1234!   (일반 사용자)"
Write-Host ""
Write-Host "  종료      : .\run.ps1 -Stop  (또는 각 서비스 창 닫기)"

if (-not ($ai -and $fe -and $be)) {
    Write-Host "`n일부 서비스가 기동하지 못했습니다. 해당 서비스 창의 로그를 확인하세요." -ForegroundColor Yellow
    exit 1
}
