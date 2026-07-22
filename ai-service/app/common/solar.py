"""태양고도(solar elevation) 계산.

최종보고서의 미세먼지 영상분석 모델 독립변수 4종(ROI 이미지·기상정보·태양고도)
중 태양고도를 위경도+시각으로 계산한다. NOAA 근사식(fractional year 기반
균시차·적위)을 사용하며 대기 굴절 보정은 하지 않는다(모델 입력 특징 용도로 충분).

시각 처리 규약: naive datetime은 KST(+09:00)로 간주한다
(관측/촬영 시각이 한국 기준으로 기록되는 프로젝트 규약).
"""

import math
from datetime import datetime, timedelta, timezone

KST = timezone(timedelta(hours=9))


def solar_elevation_deg(latitude_deg: float, longitude_deg: float,
                        when: datetime) -> float:
    """주어진 위치·시각의 태양고도(도, 지평선 위 +, 아래 -)를 반환한다."""
    if not -90 <= latitude_deg <= 90:
        raise ValueError(f"위도 범위 오류: {latitude_deg}")
    if not -180 <= longitude_deg <= 180:
        raise ValueError(f"경도 범위 오류: {longitude_deg}")

    if when.tzinfo is None:
        when = when.replace(tzinfo=KST)
    utc = when.astimezone(timezone.utc)

    day_of_year = utc.timetuple().tm_yday
    frac_hour = utc.hour + utc.minute / 60 + utc.second / 3600

    # fractional year (라디안)
    gamma = 2 * math.pi / 365 * (day_of_year - 1 + (frac_hour - 12) / 24)

    # 균시차 (분)
    eqtime = 229.18 * (0.000075
                       + 0.001868 * math.cos(gamma) - 0.032077 * math.sin(gamma)
                       - 0.014615 * math.cos(2 * gamma) - 0.040849 * math.sin(2 * gamma))

    # 태양 적위 (라디안)
    decl = (0.006918
            - 0.399912 * math.cos(gamma) + 0.070257 * math.sin(gamma)
            - 0.006758 * math.cos(2 * gamma) + 0.000907 * math.sin(2 * gamma)
            - 0.002697 * math.cos(3 * gamma) + 0.00148 * math.sin(3 * gamma))

    # 진태양시(분) → 시간각(라디안). cos은 주기함수라 범위 보정 불필요
    true_solar_minutes = frac_hour * 60 + eqtime + 4 * longitude_deg
    hour_angle = math.radians(true_solar_minutes / 4 - 180)

    lat = math.radians(latitude_deg)
    elevation = math.asin(
        math.sin(lat) * math.sin(decl)
        + math.cos(lat) * math.cos(decl) * math.cos(hour_angle))
    return math.degrees(elevation)
