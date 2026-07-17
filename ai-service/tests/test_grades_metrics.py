"""등급 계산 / 성능지표 테스트."""

import numpy as np
import pytest

from app.model.grades import load_grade_scale
from app.model.metrics import full_metrics, grade_metrics, regression_metrics

scale = load_grade_scale("config/grades.json")


class TestGrades:

    @pytest.mark.parametrize("pm25,expected", [
        (0.0, "좋음"), (15.0, "좋음"), (15.5, "보통"), (16.0, "보통"),
        (35.0, "보통"), (36.0, "나쁨"), (75.0, "나쁨"),
        (76.0, "매우나쁨"), (150.0, "매우나쁨"),
    ])
    def test_grade_boundaries(self, pm25, expected):
        assert scale.grade_of(pm25) == expected

    def test_negative_raises(self):
        with pytest.raises(ValueError):
            scale.grade_of(-1.0)

    def test_labels_order(self):
        assert scale.names == ["좋음", "보통", "나쁨", "매우나쁨"]


class TestRegressionMetrics:

    def test_perfect_prediction(self):
        y = np.array([10.0, 20.0, 30.0])
        m = regression_metrics(y, y)
        assert m["mae"] == 0.0
        assert m["rmse"] == 0.0
        assert m["mape"] == 0.0
        assert m["r2"] == 1.0

    def test_known_values(self):
        y_true = np.array([10.0, 20.0, 30.0, 40.0])
        y_pred = np.array([12.0, 18.0, 33.0, 36.0])
        m = regression_metrics(y_true, y_pred)
        # 수기 계산: |오차| = [2,2,3,4] → MAE=2.75
        assert m["mae"] == pytest.approx(2.75)
        # RMSE = sqrt((4+4+9+16)/4) = sqrt(8.25)
        assert m["rmse"] == pytest.approx(np.sqrt(8.25))
        # MAPE = mean(2/10, 2/20, 3/30, 4/40)*100 = mean(0.2,0.1,0.1,0.1)*100 = 12.5
        assert m["mape"] == pytest.approx(12.5)
        assert 0 < m["r2"] < 1

    def test_size_mismatch_raises(self):
        with pytest.raises(ValueError):
            regression_metrics(np.array([1.0]), np.array([1.0, 2.0]))


class TestGradeMetrics:

    def test_all_correct(self):
        y = np.array([10.0, 20.0, 50.0, 100.0])  # 좋음/보통/나쁨/매우나쁨
        m = grade_metrics(y, y, scale)
        assert m["grade_accuracy"] == 1.0
        assert np.trace(np.array(m["confusion_matrix"])) == 4

    def test_partial_correct(self):
        y_true = np.array([10.0, 20.0])   # 좋음, 보통
        y_pred = np.array([10.0, 50.0])   # 좋음, 나쁨
        m = grade_metrics(y_true, y_pred, scale)
        assert m["grade_accuracy"] == 0.5
        matrix = np.array(m["confusion_matrix"])
        assert matrix[0][0] == 1  # 좋음→좋음
        assert matrix[1][2] == 1  # 보통→나쁨 (오분류)

    def test_full_metrics_has_all_keys(self):
        y = np.array([10.0, 20.0, 50.0])
        m = full_metrics(y, y, scale)
        assert set(m) == {"mae", "rmse", "mape", "r2",
                          "grade_accuracy", "labels", "confusion_matrix"}
