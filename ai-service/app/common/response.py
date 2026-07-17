"""모든 API가 공통으로 사용하는 응답 래퍼.

형식: { "success": true, "data": {}, "message": null, "timestamp": "ISO-8601" }
백엔드(Spring Boot)의 ApiResponse와 동일한 구조를 유지한다.
"""

from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class ApiResponse(BaseModel):
    success: bool = True
    data: Any = None
    message: str | None = None
    timestamp: str = Field(default_factory=_now_iso)

    @classmethod
    def ok(cls, data: Any = None) -> "ApiResponse":
        return cls(success=True, data=data)

    @classmethod
    def error(cls, message: str) -> "ApiResponse":
        return cls(success=False, message=message)
