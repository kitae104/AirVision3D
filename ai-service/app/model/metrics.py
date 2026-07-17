"""회귀·등급 분류 성능지표.

주의(스펙 요구):
- 회귀 성능은 MAE / RMSE / MAPE / R² 로 평가한다.
- '정확도(Accuracy)'와 혼동행렬은 **등급 분류**에만 사용한다.
"""

import numpy as np

from app.model.grades import GradeScale


def regression_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, float]:
    """MAE, RMSE, MAPE(%), R²."""
    y_true = np.asarray(y_true, dtype=np.float64).ravel()
    y_pred = np.asarray(y_pred, dtype=np.float64).ravel()
    if y_true.shape != y_pred.shape or y_true.size == 0:
        raise ValueError("y_true/y_pred 크기가 다르거나 비어 있습니다")

    error = y_pred - y_true
    mae = float(np.mean(np.abs(error)))
    rmse = float(np.sqrt(np.mean(error ** 2)))
    # 0에 가까운 실측값의 division 폭주 방지 (실측 하한 1.0 적용)
    mape = float(np.mean(np.abs(error) / np.maximum(np.abs(y_true), 1.0)) * 100.0)
    ss_res = float(np.sum(error ** 2))
    ss_tot = float(np.sum((y_true - y_true.mean()) ** 2))
    r2 = 1.0 - ss_res / ss_tot if ss_tot > 1e-12 else 0.0
    return {"mae": mae, "rmse": rmse, "mape": mape, "r2": r2}


def grade_metrics(y_true: np.ndarray, y_pred: np.ndarray,
                  scale: GradeScale) -> dict:
    """등급 분류 정확도와 혼동행렬.

    Returns:
        {"grade_accuracy": float, "labels": [...],
         "confusion_matrix": [[...]]}  # 행=실제, 열=예측
    """
    labels = scale.names
    index = {name: i for i, name in enumerate(labels)}
    true_grades = [scale.grade_of(max(0.0, v)) for v in np.ravel(y_true)]
    pred_grades = [scale.grade_of(max(0.0, v)) for v in np.ravel(y_pred)]

    matrix = np.zeros((len(labels), len(labels)), dtype=int)
    for t, p in zip(true_grades, pred_grades):
        matrix[index[t], index[p]] += 1

    accuracy = float(np.trace(matrix) / matrix.sum()) if matrix.sum() else 0.0
    return {
        "grade_accuracy": accuracy,
        "labels": labels,
        "confusion_matrix": matrix.tolist(),
    }


def full_metrics(y_true: np.ndarray, y_pred: np.ndarray, scale: GradeScale) -> dict:
    """회귀 + 등급 지표를 합쳐서 반환한다."""
    return {**regression_metrics(y_true, y_pred), **grade_metrics(y_true, y_pred, scale)}
