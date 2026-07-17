"""미세먼지 등급 계산.

등급 경계는 하드코딩하지 않고 설정 파일(config/grades.json)에서 로드한다.
설정 파일이 없으면 한국 기준 기본값을 사용한다.
"""

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

# 설정 파일 부재 시 기본값 (한국 환경부 PM2.5 기준)
DEFAULT_GRADES = [
    {"name": "좋음", "upper": 15},
    {"name": "보통", "upper": 35},
    {"name": "나쁨", "upper": 75},
    {"name": "매우나쁨", "upper": None},
]


@dataclass(frozen=True)
class GradeScale:
    """upper 오름차순 등급 목록. 마지막 등급의 upper는 None(상한 없음)이어야 한다."""

    grades: tuple[dict, ...]

    def grade_of(self, pm25: float) -> str:
        if pm25 < 0:
            raise ValueError(f"PM2.5는 0 이상이어야 합니다: {pm25}")
        for grade in self.grades:
            if grade["upper"] is None or pm25 <= grade["upper"]:
                return grade["name"]
        return self.grades[-1]["name"]

    @property
    def names(self) -> list[str]:
        return [g["name"] for g in self.grades]


@lru_cache
def load_grade_scale(config_path: str = "config/grades.json") -> GradeScale:
    path = Path(config_path)
    if path.exists():
        data = json.loads(path.read_text(encoding="utf-8"))
        grades = data["grades"]
    else:
        grades = DEFAULT_GRADES
    if grades[-1]["upper"] is not None:
        raise ValueError("마지막 등급의 upper는 null(상한 없음)이어야 합니다")
    return GradeScale(grades=tuple(grades))
