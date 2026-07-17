"""AirVision 3D AI Service 진입점.

Phase 1: 헬스체크만 제공한다.
Phase 4~5에서 전처리/학습/추론 라우터를 추가한다.
"""

from fastapi import FastAPI

from app.common.response import ApiResponse
from app.core.config import get_settings

app = FastAPI(
    title="AirVision 3D AI Service",
    description="이미지 전처리, AI 학습·추론을 담당하는 서비스",
    version="0.1.0",
)


@app.get("/health")
def health() -> ApiResponse:
    """서비스 생존 확인용 헬스체크. 외부 의존성 없이 기동 여부만 확인한다."""
    settings = get_settings()
    return ApiResponse.ok({"status": "UP", "service": settings.service_name})
