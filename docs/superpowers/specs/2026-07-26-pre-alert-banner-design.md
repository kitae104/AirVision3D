# 예측 기반 사전 경보 배너 설계 (Phase 34)

- 작성일: 2026-07-26
- 상태: 사용자 승인(제안 목록에서 선택) 후 구현

## 목적

이류 예측(구별 시간별 농도, `GET /api/air-quality/district-forecast?hours=6`)을 이용해
"N시간 후 ○○구 '나쁨' 진입 예상" 같은 사전 경보를 모든 페이지 상단에 표시한다.
Phase 15의 공식 경보 배너(AlertBanner, 발령 중인 경보)와 구분되는 **예측 기반** 안내다.

## 동작 규칙

- 대상: 인천 핵심 3구(미추홀·남동·연수) — district-forecast 응답 그대로.
- 조건: 시간별 예측 등급이 **현재 등급보다 나빠지고** 그 등급이 **나쁨 이상**인
  첫 시점을 구별로 찾는다. 같은 구에서 더 나쁜 등급(매우나쁨)에 도달하면
  가장 나쁜 등급의 첫 도달 시점을 보고한다.
- 현재 이미 나쁨 이상인 구는 같은 등급 유지로는 경보하지 않는다
  (더 악화되어 매우나쁨 진입이 예상될 때만 표시).
- 문구: `⚠️ 예측 사전 경보 · 남동구 약 3시간 후 '나쁨' 진입 예상 (PM2.5 38.2, 15시)`
  + "단순 이류 추정 참고용" 안내. mock=true면 "(Mock)" 배지 병기.
- 예측이 없거나(주말 API 장애 등) 조회 실패면 아무것도 표시하지 않는다(AlertBanner와 동일).

## 구현 (프론트 전용 — 백엔드 변경 없음)

- `api/client.ts`: `DistrictForecast` 응답 타입 추가.
- `utils/preAlerts.ts` (신규): `computePreAlerts(current, hourly)` 순수 함수 —
  등급 랭크는 `config/grades.ts`의 GRADES 기준. pm25 null은 건너뜀.
  반환: `[{ district, grade, pm25, time, hoursAhead }]` (구 이름순).
- `components/PreAlertBanner.tsx` (신규): district-forecast 조회 → 계산 → 주황(amber) 배너.
  `Layout.tsx`의 `<AlertBanner />` 아래에 마운트(모든 페이지).
- 테스트: `utils/preAlerts.test.ts` — 진입 예상·경보 없음·이미 나쁨(악화만 경보)·
  매우나쁨 직행·null 값 처리.

## 알려진 한계

- 단순 이류(advection-only) 예측 기반이므로 참고용이며 문구에 명시한다.
- 구별 값은 근사 bbox 평균으로, 공식 예·경보와 다를 수 있다.
