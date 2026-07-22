"""Modified IDW 보간 Python 기준 구현 (최종보고서 §4.1.2).

Java 구현(backend ModifiedIdwInterpolator)의 교차검증용 기준값을 산출한다.
실행: python scripts/modified_idw_reference.py
출력된 값은 backend의 ModifiedIdwInterpolatorTest 기대값으로 사용한다.

절차(보고서 표 3-11): 거리 → 1차 가중치 → leave-one-out 1차 보간 →
절대 오차 → 보정값(1 + |오차|/max|오차|) → 보정된 2차 가중치 → 최종 보간.
Java 구현과 동일하게 보고서 코드의 결함 2건(동일좌표 실측 제외, 오차 전부 0일 때
0 반환)은 보정한다.
"""

import math

EARTH_RADIUS_KM = 6371.0088  # IUGG 평균 지구 반지름 (Java GeoUtils와 동일해야 함)
ZERO_DISTANCE_EPSILON_KM = 1e-6


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """두 좌표 간 Haversine 거리(km)."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def corrections(sources: list[tuple[float, float, float]], power: float = 2.0) -> list[float]:
    """관측지점별 보정값 c_i = 1 + |오차_i| / max|오차| (절차 1~5)."""
    if not sources:
        raise ValueError("sources must not be empty")
    errors = []
    for i, (lat_i, lon_i, val_i) in enumerate(sources):
        weight_sum = 0.0
        weighted_value_sum = 0.0
        for j, (lat_j, lon_j, val_j) in enumerate(sources):
            if j == i:
                continue
            d = haversine_km(lat_j, lon_j, lat_i, lon_i)
            if d < ZERO_DISTANCE_EPSILON_KM:
                continue
            w = 1.0 / (d ** power)
            weight_sum += w
            weighted_value_sum += w * val_j
        errors.append(0.0 if weight_sum == 0.0
                      else abs(val_i - weighted_value_sum / weight_sum))
    max_error = max(errors)
    return [1.0 if max_error == 0.0 else 1.0 + e / max_error for e in errors]


def modified_idw(sources: list[tuple[float, float, float]], target_lat: float,
                 target_lon: float, power: float = 2.0) -> float:
    """Modified IDW 보간. sources: [(lat, lon, value), ...]"""
    cs = corrections(sources, power)
    weight_sum = 0.0
    weighted_value_sum = 0.0
    for (lat, lon, value), c in zip(sources, cs):
        d = haversine_km(lat, lon, target_lat, target_lon)
        if d < ZERO_DISTANCE_EPSILON_KM:
            return value
        w = c / (d ** power)
        weight_sum += w
        weighted_value_sum += w * value
    return weighted_value_sum / weight_sum


if __name__ == "__main__":
    # 검증 픽스처 1: 서울 3곳 (기존 idw_reference.py와 동일 지점)
    seoul = [
        (37.5665, 126.9780, 25.0),
        (37.4979, 127.0276, 40.0),
        (37.5268, 126.9244, 10.0),
    ]
    # 검증 픽스처 2: 인천 핵심 3구 관측소 5곳 (V4 시드 좌표)
    incheon = [
        (37.4646, 126.6803, 18.0),  # 미추홀주안
        (37.4487, 126.7016, 27.0),  # 남동구월
        (37.4013, 126.7300, 35.0),  # 남동논현
        (37.4090, 126.6660, 12.0),  # 연수동춘
        (37.3925, 126.6350, 8.0),   # 연수송도
    ]
    target_seoul = (37.5400, 126.9900)
    target_incheon = (37.4300, 126.6900)  # 3구 중앙 부근

    print("corrections(seoul, p=2)      =",
          [f"{c:.10f}" for c in corrections(seoul, 2.0)])
    print(f"mIDW seoul p=2               = {modified_idw(seoul, *target_seoul, 2.0):.10f}")
    print(f"mIDW seoul p=1               = {modified_idw(seoul, *target_seoul, 1.0):.10f}")
    print("corrections(incheon, p=2)    =",
          [f"{c:.10f}" for c in corrections(incheon, 2.0)])
    print(f"mIDW incheon p=2             = {modified_idw(incheon, *target_incheon, 2.0):.10f}")
    print(f"mIDW 관측지점 위(거리0)      = {modified_idw(incheon, 37.4646, 126.6803, 2.0):.10f}")
    print(f"mIDW 단일 관측소             = {modified_idw(incheon[:1], *target_incheon, 2.0):.10f}")
    print(f"mIDW 동일값(오차0) 전 지점   = {modified_idw([(s[0], s[1], 20.0) for s in incheon], *target_incheon, 2.0):.10f}")
