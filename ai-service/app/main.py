"""AirVision 3D AI Service 진입점."""

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse

from app.api.models_router import router as models_router
from app.common.response import ApiResponse
from app.core.config import get_settings

app = FastAPI(
    title="AirVision 3D AI Service",
    description="이미지 전처리, AI 학습·추론을 담당하는 서비스",
    version="0.2.0",
)

app.include_router(models_router)


@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc: HTTPException):
    """오류도 공통 응답 형식으로 반환한다."""
    return JSONResponse(
        status_code=exc.status_code,
        content=ApiResponse.error(str(exc.detail)).model_dump(),
    )


@app.get("/health")
def health() -> ApiResponse:
    """서비스 생존 확인용 헬스체크. 외부 의존성 없이 기동 여부만 확인한다."""
    settings = get_settings()
    return ApiResponse.ok({"status": "UP", "service": settings.service_name})
