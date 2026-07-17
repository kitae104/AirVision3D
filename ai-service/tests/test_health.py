"""헬스체크 API가 공통 응답 형식으로 200을 반환하는지 검증한다."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_ok_with_common_response_format():
    res = client.get("/health")
    assert res.status_code == 200

    body = res.json()
    assert body["success"] is True
    assert body["data"]["status"] == "UP"
    assert body["data"]["service"] == "airvision-ai-service"
    assert body["message"] is None
    assert "timestamp" in body
