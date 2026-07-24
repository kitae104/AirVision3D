# 바람길 시각화 + PM2.5 이동 예측 설계 (Phase 28)

- 작성일: 2026-07-24
- 상태: 사용자 설계 승인 완료
- 대상 지역: 인천 미추홀구·남동구·연수구

## 1. 목표

1. 인천 핵심 3구 영역의 실시간·예보 바람장(풍향/풍속 격자)을 확보한다.
2. CesiumJS 지도 위에 Windy 스타일 GPU 파티클 애니메이션으로 바람길을 시각화한다.
3. 현재 PM2.5 분포가 바람에 따라 +1h~+6h 동안 어떻게 이동하는지 단순 이류(advection) 모델로 예측하고 지도에 표시한다.

## 2. 범위

- 포함: 바람장 수집 API, 파티클 애니메이션 레이어, semi-Lagrangian 이류 예측, 시간 슬라이더(+0h~+6h), Mock 폴백, 테스트, 문서 갱신.
- 제외(향후): 확산·배출·침적 모델링, AI 모델과의 결합, 3구 외 지역 확장, 연직(고도별) 바람.

## 3. 데이터 소스 결정

- **기상청 초단기예보(getUltraSrtFcst) 확장** 채택.
  - 기존 `KmaWeatherClient`(초단기실황·초단기예보 연동, Mock fixture, TTL 캐시, 결측 |값|≥900 처리)를 재사용.
  - 초단기예보는 발표 시각 기준 +6시간, 1시간 간격, 5km 격자(LCC nx/ny) 데이터를 제공한다.
  - 바람 성분: UUU(동서 m/s), VVV(남북 m/s) 우선 사용, 없으면 VEC(풍향 deg)/WSD(풍속 m/s)에서 UV로 변환.
- 대안으로 검토했던 Open-Meteo(키 불필요)는 신규 외부 의존성 추가와 공식성 문제로 미채택. 기상청 장애 시에는 기존 패턴대로 stale 캐시 → Mock fixture 순으로 폴백한다.

## 4. 아키텍처

### 4.1 Backend — `publicdata/wind/` 패키지 (신규)

- **격자점 정의**: 인천권 bounding box(lon 126.45~126.95, lat 37.25~37.60)를 덮는 KMA 격자 샘플 지점 3×3=9개를 상수로 고정 정의. 3구만 덮으면 도메인이 너무 작아(약 20km) 이류 계산 시 1시간 만에 경계 유입이 지배하므로, 상류(주변부)를 포함한 인천권으로 영역을 넓힌다.
- **`WindFieldService`**
  - 각 격자점에 대해 초단기예보를 호출해 시간별(발표 기준 +6h) UV 성분을 수집한다.
  - 9개 coarse 격자점 → 정규 위경도 격자(약 25×25)로 IDW 보간해 `cesium-wind-layer` 입력 형식으로 변환한다.
  - TTL 캐시(발표 주기 고려, stale 폴백) 적용.
- **`AdvectionService`**
  - 초기 농도장: 기존 `PublicIdwService`의 실측 IDW 격자 재사용.
  - 시간별 바람장으로 semi-Lagrangian 역추적(각 셀에서 바람을 거슬러 1시간 전 위치의 농도를 bilinear 샘플링)을 1시간 간격 +6h까지 반복.
  - 경계 처리: 도메인 밖 역추적 시 최근접 경계값 유지(clamp).
  - 순수 이류 모델임을 응답에 `model: "advection-only"`로 명시.
- **API**
  - `GET /api/wind/field` → `{ bounds, width, height, hours: [{ time, u[], v[], speedMin, speedMax }] }`
  - `GET /api/wind/advection?hours=6` → `{ bounds, width, height, model, frames: [{ time, pm25[] }] }`
- **Mock**: 기존 `fixtures/kma/raw/ultra_fcst.json`을 그대로 재사용한다. Mock 모드에서는 모든 격자점이 동일 응답을 받아 균일 바람장이 되지만, 파티클 애니메이션·이류 계산·API 계약 검증에는 충분하다 (알려진 한계로 기록).

### 4.2 Frontend — MapPage

- `cesium-wind-layer@0.10.1` 설치 (peer: cesium ^1.127.0, 현재 1.143 호환 확인됨).
- `LayerKey`에 2종 추가:
  - `wind`: `WindLayer` 파티클 애니메이션(풍속에 따른 색·속도, Windy 스타일). 체크박스 on/off.
  - `advection`: 이류 예측 프레임을 기존 `addIdwSurface` 셀 타일링 방식으로 렌더. "단순 이류 추정" 배지 표시.
- **시간 컨트롤**: +0h~+6h 슬라이더(또는 버튼 그룹). 변경 시 WindLayer 데이터 교체 + advection 프레임 전환.

## 5. 오류 처리

- 기상청 API 장애/키 부재: TTL stale 캐시 → Mock fixture 폴백(기존 패턴).
- 결측값(|값|≥900): 해당 격자점 제외 후 나머지로 보간, 전 지점 결측 시 오류 응답.
- IDW 격자 부재(관측 데이터 없음): advection API는 명시적 4xx와 안내 메시지 반환, 프론트는 레이어 비활성화 안내.

## 6. 테스트 계획

- Backend 단위: VEC/WSD→UV 변환, coarse→fine IDW 보간, semi-Lagrangian 검증(균일 서풍 → 농도장 동쪽 이동), 경계 clamp.
- Backend 통합: Mock 폴백으로 `/api/wind/field`, `/api/wind/advection` 응답 검증, Gradle 빌드.
- Frontend: TypeScript 검사, Vite 빌드, 지도 레이어 렌더링 확인.
- 실키 스모크: 실제 기상청 서비스키로 3구 격자점 예보 수집 확인.

## 7. 문서

- `docs/progress.md`에 Phase 28 항목 추가.
- `docs/user-guide.html`에 바람길/이동 예측 레이어 사용법 + 업데이트 이력 갱신.
