"""네트워크 forward / 학습 smoke / 추론 / API 테스트."""

import io

import pytest
import torch
from fastapi.testclient import TestClient
from PIL import Image

from app.model.network import MultimodalPm25Net
from app.model.predict import Predictor
from app.model.train import train_model


def test_network_forward_shape():
    model = MultimodalPm25Net(pretrained=False)
    image = torch.randn(2, 3, 64, 64)
    env = torch.randn(2, 3)
    output = model(image, env)
    assert output.shape == (2, 1)


@pytest.fixture(scope="session")
def trained_model(small_dataset, tmp_path_factory):
    """1 epoch smoke 학습 (64px, 소형 데이터셋)."""
    dataset_dir, _ = small_dataset
    models_dir = tmp_path_factory.mktemp("models")
    summary = train_model(
        dataset_dir=dataset_dir, models_dir=models_dir,
        model_name="smoke_test_model", epochs=1, batch_size=4,
        image_size=64, pretrained=False, seed=0)
    return models_dir, summary


class TestTrainSmoke:

    def test_model_files_created(self, trained_model):
        models_dir, summary = trained_model
        model_dir = models_dir / "smoke_test_model"
        for name in ["model.pt", "config.json", "scaler.json",
                     "history.json", "metrics.json"]:
            assert (model_dir / name).exists(), f"{name} 누락"

    def test_metrics_contains_required_keys(self, trained_model):
        _, summary = trained_model
        metrics = summary["metrics"]
        for key in ["mae", "rmse", "mape", "r2", "grade_accuracy", "confusion_matrix"]:
            assert key in metrics
        assert metrics["mae"] >= 0

    def test_history_per_epoch(self, trained_model):
        _, summary = trained_model
        assert len(summary["history"]) == 1
        assert "train_loss" in summary["history"][0]
        assert "val_mae" in summary["history"][0]


class TestPredictor:

    def test_predict_returns_pm25_and_grade(self, trained_model):
        models_dir, _ = trained_model
        predictor = Predictor.load(models_dir / "smoke_test_model")
        image = Image.new("RGB", (320, 240), (150, 160, 170))
        result = predictor.predict(image, temperature=24.0, humidity=60.0, wind_speed=2.0)
        assert result["pm25"] >= 0
        assert result["grade"] in ["좋음", "보통", "나쁨", "매우나쁨"]

    def test_load_missing_model_raises(self, tmp_path):
        with pytest.raises(FileNotFoundError):
            Predictor.load(tmp_path / "no_such_model")


class TestPredictApi:

    @pytest.fixture()
    def client(self, trained_model, monkeypatch):
        models_dir, _ = trained_model
        from app.core.config import Settings, get_settings
        from app.main import app

        get_settings.cache_clear()
        monkeypatch.setenv("DATA_DIR", str(models_dir.parent))
        # models_dir 프로퍼티가 <data_dir>/models 이므로 상위 디렉터리 이름을 맞춤
        monkeypatch.setattr(Settings, "models_dir",
                            property(lambda self: str(models_dir)))
        yield TestClient(app)
        get_settings.cache_clear()

    def _image_bytes(self) -> bytes:
        buf = io.BytesIO()
        Image.new("RGB", (320, 240), (140, 150, 160)).save(buf, format="PNG")
        return buf.getvalue()

    def test_predict_endpoint(self, client):
        res = client.post(
            "/models/smoke_test_model/predict",
            files={"image": ("test.png", self._image_bytes(), "image/png")},
            data={"temperature": 24.0, "humidity": 60.0, "wind_speed": 2.0})
        assert res.status_code == 200
        body = res.json()
        assert body["success"] is True
        assert body["data"]["pm25"] >= 0
        assert body["data"]["grade"] in ["좋음", "보통", "나쁨", "매우나쁨"]

    def test_predict_unknown_model_returns_404(self, client):
        res = client.post(
            "/models/no_such_model/predict",
            files={"image": ("test.png", self._image_bytes(), "image/png")},
            data={"temperature": 24.0, "humidity": 60.0, "wind_speed": 2.0})
        assert res.status_code == 404
        assert res.json()["success"] is False

    def test_list_models(self, client):
        res = client.get("/models")
        assert res.status_code == 200
        names = [m["model_name"] for m in res.json()["data"]]
        assert "smoke_test_model" in names

    def test_model_metrics_endpoint(self, client):
        res = client.get("/models/smoke_test_model/metrics")
        assert res.status_code == 200
        assert "mae" in res.json()["data"]

    # --- 경로 조작(Path Traversal) 방어 ---

    @pytest.mark.parametrize("bad_name", [
        "..", "..%2F..%2Fetc", "a" * 65, "한글모델", "name with space",
    ])
    def test_metrics_rejects_invalid_model_name(self, client, bad_name):
        res = client.get(f"/models/{bad_name}/metrics")
        assert res.status_code in (400, 404)
        if res.status_code == 400:
            assert res.json()["success"] is False

    def test_predict_rejects_traversal_model_name(self, client):
        # ".."이 포함된 모델명은 검증 단계에서 400으로 거부되어야 한다
        res = client.post(
            "/models/..smoke_test_model/predict",
            files={"image": ("t.png", self._image_bytes(), "image/png")},
            data={"temperature": 24.0, "humidity": 60.0, "wind_speed": 2.0})
        assert res.status_code == 400

    def test_predict_encoded_slash_never_reaches_handler(self, client):
        # 인코딩된 경로 구분자는 라우팅 단계에서 404로 차단된다 (안전한 거부)
        res = client.post(
            "/models/%2E%2E%2Fsmoke_test_model/predict",
            files={"image": ("t.png", self._image_bytes(), "image/png")},
            data={"temperature": 24.0, "humidity": 60.0, "wind_speed": 2.0})
        assert res.status_code in (400, 404)

    def test_train_rejects_dataset_outside_data_dir(self, client):
        res = client.post("/models/train", json={
            "model_name": "traversal_test",
            "dataset_dir": "C:/Windows/System32",
            "epochs": 1})
        assert res.status_code == 400
        assert res.json()["success"] is False
