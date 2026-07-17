# IDW 공간 보간 알고리즘

## 1. 개요

관측소가 없는 지점의 PM2.5 값을 주변 관측소 값의 **거리 역가중 평균**으로 추정한다.

```
value(target) = Σ( w_i × v_i ) / Σ( w_i ),   w_i = 1 / d_i^p
```

- `v_i` : i번째 관측소의 PM2.5 관측값
- `d_i` : 대상 지점과 i번째 관측소 사이의 거리 (km)
- `p`   : 거리 가중치 지수 (설정 가능, 기본 2.0, API에서 0.1~10 허용)

p가 클수록 가까운 관측소의 영향이 커진다.

## 2. 거리 계산 — Haversine

위경도 좌표 간 구면 거리를 사용한다.

```
a = sin²(Δφ/2) + cos(φ1)·cos(φ2)·sin²(Δλ/2)
d = 2R · asin(√a),  R = 6371.0088 km (IUGG 평균 지구 반지름)
```

Java(`GeoUtils.haversineKm`)와 Python(`scripts/idw_reference.py`)이 동일한 R을 사용한다.

## 3. 경계 조건 처리

| 조건 | 처리 |
|---|---|
| 대상 지점 = 관측소 좌표 (거리 < 1e-6 km) | 보간하지 않고 해당 관측소의 실제 관측값 반환 |
| 관측소 1개 | 그 관측소 값 반환 (가중평균이 자연스럽게 수렴) |
| 관측소 0개 | IllegalArgumentException → HTTP 400 |
| p ≤ 0 | IllegalArgumentException → HTTP 400 |
| 결과 범위 | 가중평균이므로 항상 [min(v), max(v)] 이내 (테스트로 보장) |

## 4. 구현 위치

| 구성 | 파일 |
|---|---|
| Java 구현 | `backend/.../common/GeoUtils.java`, `backend/.../interpolation/IdwInterpolator.java` |
| Python 기준 구현 | `scripts/idw_reference.py` |
| 단위 테스트 | `GeoUtilsTest`, `IdwInterpolatorTest` (backend) |
| API | `POST /api/interpolations/run`, `GET /api/interpolations` |
| 결과 저장 | `interpolation_results` 테이블 (geom은 좌표에서 자동 생성) |

## 5. 교차검증 결과 (2026-07-17)

Python 기준 구현을 실행해 얻은 값을 Java 단위 테스트의 기대값으로 사용하며,
**허용오차 1e-6** 이내 일치를 `gradlew test`로 상시 검증한다.

| 케이스 | Python 기준값 | Java 검증 |
|---|---|---|
| Haversine 서울시청–강남역 | 8.7929030260 km | ✅ 1e-6 이내 일치 |
| Haversine 서울–부산 | 325.1117079126 km | ✅ |
| IDW p=2 (픽스처 3개 관측소) | 25.2155319213 | ✅ |
| IDW p=1 | 25.1529967894 | ✅ |
| IDW p=3 | 25.2082812034 | ✅ |
| 관측지점 위(거리 0) | 25.0 (실제값) | ✅ |
| 단일 관측소 | 25.0 | ✅ |

실 DB 검증(원격 PostgreSQL): 임의 2개 지점 보간 + 관측소 동일 좌표 입력 시
해당 관측소의 최신 실제 관측값이 그대로 반환됨을 API 호출로 확인.

## 6. API 사용 예

```http
POST /api/interpolations/run
Content-Type: application/json

{
  "power": 2.0,
  "observedAt": null,
  "targets": [
    { "name": "서울숲", "latitude": 37.5443, "longitude": 127.0374 }
  ]
}
```

- 관측지점은 DB의 **관측소별 최신 PM2.5**(기준 시각 `observedAt` 이전)를 자동 사용
- 결과는 `interpolation_results`에 저장되고 응답으로도 반환

## 7. 선택 기능 — Modified IDW (후순위)

오차 기반 보정계수를 적용한 2차 가중치 방식. 필수 기능 전체 VERIFIED 후
별도 모듈로 구현하고 일반 IDW와 MAE/RMSE를 비교한다. (implementation-plan.md 참고)
