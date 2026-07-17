"""IDW 보간 Python 기준 구현.

Java 구현(backend IdwInterpolator)의 교차검증용 기준값을 산출한다.
실행: python scripts/idw_reference.py
출력된 값은 backend의 IdwInterpolatorTest 기대값으로 사용한다.
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


def idw(sources: list[tuple[float, float, float]], target_lat: float, target_lon: float,
        power: float = 2.0) -> float:
    """일반 IDW 보간. sources: [(lat, lon, value), ...]

    - 거리 0(엡실론 이내) 지점이 있으면 해당 관측값을 그대로 반환한다.
    """
    if not sources:
        raise ValueError("sources must not be empty")

    weight_sum = 0.0
    weighted_value_sum = 0.0
    for lat, lon, value in sources:
        d = haversine_km(lat, lon, target_lat, target_lon)
        if d < ZERO_DISTANCE_EPSILON_KM:
            return value
        w = 1.0 / (d ** power)
        weight_sum += w
        weighted_value_sum += w * value
    return weighted_value_sum / weight_sum


if __name__ == "__main__":
    # 검증 픽스처: 서울 시청/강남역/여의도공원 (Java 테스트와 동일해야 함)
    sources = [
        (37.5665, 126.9780, 25.0),
        (37.4979, 127.0276, 40.0),
        (37.5268, 126.9244, 10.0),
    ]
    target = (37.5400, 126.9900)

    print(f"haversine 서울시청-강남역     = {haversine_km(37.5665, 126.9780, 37.4979, 127.0276):.10f} km")
    print(f"haversine 서울-부산           = {haversine_km(37.5665, 126.9780, 35.1796, 129.0756):.10f} km")
    print(f"haversine 동일좌표            = {haversine_km(37.5, 127.0, 37.5, 127.0):.10f} km")
    print(f"IDW p=2                       = {idw(sources, *target, 2.0):.10f}")
    print(f"IDW p=1                       = {idw(sources, *target, 1.0):.10f}")
    print(f"IDW p=3                       = {idw(sources, *target, 3.0):.10f}")
    print(f"IDW 관측지점 위(거리0)        = {idw(sources, 37.5665, 126.9780, 2.0):.10f}")
    print(f"IDW 단일 관측소               = {idw(sources[:1], *target, 2.0):.10f}")
