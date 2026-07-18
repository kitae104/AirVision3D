# =====================================================================
# AirVision 3D 통합 테스트 (전체 스택이 실행 중이어야 함: .\run.ps1)
# 사용법: powershell -ExecutionPolicy Bypass -File .\scripts\integration-test.ps1
# =====================================================================
$ErrorActionPreference = "SilentlyContinue"
$base = "http://127.0.0.1:8080/api"
$script:passed = 0
$script:failed = 0

function Assert-True {
    param([string]$Name, [bool]$Condition, [string]$Detail = "")
    if ($Condition) {
        Write-Host ("  [PASS] {0}" -f $Name) -ForegroundColor Green
        $script:passed++
    } else {
        Write-Host ("  [FAIL] {0} {1}" -f $Name, $Detail) -ForegroundColor Red
        $script:failed++
    }
}

function Get-StatusCode {
    param([string]$Method = "GET", [string]$Url, [hashtable]$Headers = @{}, [string]$Body = $null, [string]$ContentType = "application/json")
    try {
        $params = @{ Method = $Method; Uri = $Url; Headers = $Headers; TimeoutSec = 30; UseBasicParsing = $true }
        if ($Body) { $params.Body = [System.Text.Encoding]::UTF8.GetBytes($Body); $params.ContentType = "$ContentType; charset=utf-8" }
        $r = Invoke-WebRequest @params
        return [int]$r.StatusCode
    } catch {
        if ($_.Exception.Response) { return [int]$_.Exception.Response.StatusCode.value__ }
        return 0
    }
}

Write-Host "`n=== 1. 헬스체크 ===" -ForegroundColor Cyan
Assert-True "backend /api/health" ((Get-StatusCode -Url "$base/health") -eq 200)
Assert-True "ai-service /health" ((Get-StatusCode -Url "http://127.0.0.1:8000/health") -eq 200)
Assert-True "frontend :5173" ((Get-StatusCode -Url "http://127.0.0.1:5173") -eq 200)

Write-Host "`n=== 2. 인증 ===" -ForegroundColor Cyan
$admin = $null
try { $admin = (Invoke-RestMethod -Method Post -Uri "$base/auth/login" -ContentType "application/json" -Body '{"username":"admin","password":"admin1234!"}').data } catch {}
Assert-True "admin 로그인" ($null -ne $admin.token)
$H = @{ Authorization = "Bearer $($admin.token)" }
$user = $null
try { $user = (Invoke-RestMethod -Method Post -Uri "$base/auth/login" -ContentType "application/json" -Body '{"username":"user","password":"user1234!"}').data } catch {}
Assert-True "user 로그인" ($null -ne $user.token)
$UH = @{ Authorization = "Bearer $($user.token)" }
Assert-True "잘못된 비밀번호 -> 401" ((Get-StatusCode -Method Post -Url "$base/auth/login" -Body '{"username":"admin","password":"wrong"}') -eq 401)
Assert-True "무토큰 조회 -> 401" ((Get-StatusCode -Url "$base/sites") -eq 401)
Assert-True "USER 등록 시도 -> 403" ((Get-StatusCode -Method Post -Url "$base/sites" -Headers $UH -Body '{"name":"x","latitude":37,"longitude":127}') -eq 403)

Write-Host "`n=== 3. 관측소/관측값 CRUD ===" -ForegroundColor Cyan
$sites = (Invoke-RestMethod "$base/sites" -Headers $H).data
Assert-True "샘플 관측소 7곳 이상" ($sites.Count -ge 7) "(현재 $($sites.Count))"
$detail = (Invoke-RestMethod "$base/sites/$($sites[0].id)" -Headers $H).data
Assert-True "PostGIS geomWkt 조회" ($detail.geomWkt -like "POINT*")
$newSite = $null
try { $newSite = (Invoke-RestMethod -Method Post -Uri "$base/sites" -Headers $H -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes('{"name":"통합테스트지점","latitude":37.4,"longitude":127.2,"siteType":"SENSOR"}'))).data } catch {}
Assert-True "관측소 등록" ($null -ne $newSite.id)
Assert-True "잘못된 위도 -> 400" ((Get-StatusCode -Method Post -Url "$base/sites" -Headers $H -Body '{"name":"bad","latitude":999,"longitude":0}') -eq 400)
$newObs = $null
try { $newObs = (Invoke-RestMethod -Method Post -Uri "$base/observations" -Headers $H -ContentType "application/json" -Body ('{"siteId":' + $newSite.id + ',"observedAt":"2026-07-18T03:00:00Z","pm25":42.5,"temperature":26,"humidity":55,"windSpeed":1.8}')).data } catch {}
Assert-True "관측값 등록" ($null -ne $newObs.id)
$obsList = (Invoke-RestMethod "$base/observations?siteId=$($newSite.id)" -Headers $H).data
Assert-True "관측값 필터 조회" ($obsList.totalElements -eq 1)
Assert-True "관측소 삭제(CASCADE)" ((Get-StatusCode -Method DELETE -Url "$base/sites/$($newSite.id)" -Headers $H) -eq 200)
Assert-True "삭제 후 조회 -> 404" ((Get-StatusCode -Url "$base/sites/$($newSite.id)" -Headers $H) -eq 404)

Write-Host "`n=== 4. 대시보드 ===" -ForegroundColor Cyan
$sum = (Invoke-RestMethod "$base/dashboard/summary" -Headers $H).data
Assert-True "요약(평균 PM2.5·등급·관측소 수)" ($null -ne $sum.latestAvgPm25 -and $null -ne $sum.grade -and $sum.siteCount -ge 7)
$hourly = (Invoke-RestMethod "$base/dashboard/hourly?hours=24" -Headers $H).data
Assert-True "시간별 차트 데이터" ($hourly.Count -gt 0)

Write-Host "`n=== 5. IDW 보간 ===" -ForegroundColor Cyan
$idw = $null
try { $idw = (Invoke-RestMethod -Method Post -Uri "$base/interpolations/run" -Headers $H -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes('{"power":2.0,"targets":[{"name":"통합테스트","latitude":37.50,"longitude":127.00},{"name":"동일좌표","latitude":37.5665,"longitude":126.9780}]}'))).data } catch {}
Assert-True "보간 실행 (2개 지점)" ($idw.Count -eq 2)
$latestObs = (Invoke-RestMethod "$base/observations?siteId=1&size=1" -Headers $H).data.content[0]
Assert-True "동일좌표 -> 실제 관측값 반환" ($idw[1].pm25 -eq $latestObs.pm25) "(보간=$($idw[1].pm25), 실제=$($latestObs.pm25))"
Assert-True "빈 대상 -> 400" ((Get-StatusCode -Method Post -Url "$base/interpolations/run" -Headers $H -Body '{"power":2.0,"targets":[]}') -eq 400)

Write-Host "`n=== 6. AI 예측 ===" -ForegroundColor Cyan
$img = Get-ChildItem "$PSScriptRoot\..\data\sample\dataset\images\*.png" | Select-Object -First 1
if ($null -eq $img) {
    Write-Host "  [SKIP] 샘플 이미지 없음 - scripts/generate_sample_dataset.py 실행 필요" -ForegroundColor Yellow
} else {
    $predJson = curl.exe -s -X POST "$base/predictions/run" -H "Authorization: Bearer $($admin.token)" -F "siteId=1" -F "image=@$($img.FullName)" -F "temperature=24.5" -F "humidity=60" -F "windSpeed=2.0"
    $pred = ($predJson | ConvertFrom-Json)
    Assert-True "예측 실행" ($pred.success -and $pred.data.predictedPm25 -ge 0)
    Assert-True "등급 산출" ($null -ne $pred.data.predictedGrade)
    $predList = (Invoke-RestMethod "$base/predictions?size=5" -Headers $H).data
    Assert-True "예측 목록 조회" ($predList.totalElements -ge 1)
    $metrics = (Invoke-RestMethod "$base/predictions/models/resnet18_multimodal_v1/metrics" -Headers $H).data
    Assert-True "모델 성능지표 (회귀+등급)" ($null -ne $metrics.mae -and $null -ne $metrics.grade_accuracy)
}

Write-Host "`n=== 7. 3D 시각화 데이터 ===" -ForegroundColor Cyan
$vizObs = (Invoke-RestMethod "$base/viz/observations/latest" -Headers $H).data
Assert-True "관측 레이어 데이터" ($vizObs.Count -ge 7)
$range = (Invoke-RestMethod "$base/viz/observations/time-range" -Headers $H).data
Assert-True "시계열 시간 범위" ($null -ne $range.from -and $null -ne $range.to)
$to = [DateTime]::Parse($range.to).ToUniversalTime()
$series = (Invoke-RestMethod ("$base/viz/observations/series?from=$($to.AddHours(-6).ToString('yyyy-MM-ddTHH:mm:ssZ'))&to=$($to.ToString('yyyy-MM-ddTHH:mm:ssZ'))") -Headers $H).data
Assert-True "시계열 조회 (6시간)" ($series.Count -ge 7 -and $series[0].samples.Count -ge 6)
Assert-True "Cesium 자산 서빙" ((Get-StatusCode -Url "http://127.0.0.1:5173/cesium/Widgets/widgets.css") -eq 200)

Write-Host "`n=== 8. 공공 데이터 누적 ===" -ForegroundColor Cyan
$collect = $null
try { $collect = (Invoke-RestMethod -Method Post -Uri "$base/public-data/collect" -Headers $H).data } catch {}
Assert-True "수동 수집: 측정 1건 이상" ($null -ne $collect -and $collect.measurementsUpserted -ge 1) "(현재 $($collect.measurementsUpserted))"

$hourly2 = $null
try { $hourly2 = (Invoke-RestMethod "$base/public-data/history/measurements/hourly" -Headers $H).data } catch {}
Assert-True "시간별 이력 조회 (누적)" ($null -ne $hourly2 -and $hourly2.Count -ge 1)

$pdSummary = $null
try { $pdSummary = (Invoke-RestMethod "$base/public-data/history/summary" -Headers $H).data } catch {}
Assert-True "누적 요약 건수" ($null -ne $pdSummary -and $pdSummary.accumulatedCount -ge 1) "(현재 $($pdSummary.accumulatedCount))"

Assert-True "오차 이력 조회 200" ((Get-StatusCode -Url "$base/air-quality/comparison/history" -Headers $H) -eq 200)

Write-Host "`n=== 결과 ===" -ForegroundColor Cyan
Write-Host ("  PASS: {0}  /  FAIL: {1}" -f $script:passed, $script:failed) -ForegroundColor $(if ($script:failed -eq 0) { "Green" } else { "Red" })
exit $(if ($script:failed -eq 0) { 0 } else { 1 })
