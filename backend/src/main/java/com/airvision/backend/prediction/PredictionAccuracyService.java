package com.airvision.backend.prediction;

import com.airvision.backend.dashboard.GradeProperties;
import com.airvision.backend.prediction.dto.PredictionAccuracyResponse;
import com.airvision.backend.prediction.dto.PredictionAccuracyResponse.ModelAccuracy;
import com.airvision.backend.prediction.dto.PredictionAccuracyResponse.Point;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 모델별 예측 vs 실측 정확도 집계.
 * 등급 일치율은 저장된 predicted_grade 대신 예측·실측 PM2.5를
 * 동일 기준(GradeProperties)으로 재등급화해 계산한다 (단일 기준 비교).
 */
@Service
public class PredictionAccuracyService {

    /** 산점도 응답에 담는 모델당 최대 점 수 (집계는 전체 건 기준) */
    static final int POINT_LIMIT = 300;

    private final PredictionRepository predictionRepository;
    private final GradeProperties gradeProperties;

    public PredictionAccuracyService(PredictionRepository predictionRepository,
                                     GradeProperties gradeProperties) {
        this.predictionRepository = predictionRepository;
        this.gradeProperties = gradeProperties;
    }

    @Transactional(readOnly = true)
    public PredictionAccuracyResponse report() {
        List<Prediction> all = predictionRepository.findAllWithActual();

        Map<String, List<Prediction>> byModel = new LinkedHashMap<>();
        for (Prediction p : all) {
            byModel.computeIfAbsent(p.getModel().getModelName(), k -> new ArrayList<>()).add(p);
        }

        List<ModelAccuracy> models = byModel.entrySet().stream()
                .map(e -> aggregate(e.getKey(), e.getValue()))
                .sorted(Comparator.comparingInt(ModelAccuracy::count).reversed()
                        .thenComparing(ModelAccuracy::modelName))
                .toList();

        return new PredictionAccuracyResponse(all.size(), POINT_LIMIT, models);
    }

    private ModelAccuracy aggregate(String modelName, List<Prediction> predictions) {
        double absSum = 0;
        double sqSum = 0;
        double errSum = 0;
        int gradeMatch = 0;
        for (Prediction p : predictions) {
            double error = p.getPredictedPm25() - p.getActualPm25();
            absSum += Math.abs(error);
            sqSum += error * error;
            errSum += error;
            if (gradeProperties.gradeOf(p.getPredictedPm25())
                    .equals(gradeProperties.gradeOf(p.getActualPm25()))) {
                gradeMatch++;
            }
        }
        int count = predictions.size();
        List<Point> points = predictions.stream()
                .limit(POINT_LIMIT)
                .map(p -> new Point(p.getPredictedPm25(), p.getActualPm25(),
                        p.getPredictedAt(), p.getSite().getName()))
                .toList();
        return new ModelAccuracy(modelName, count,
                absSum / count,
                Math.sqrt(sqSum / count),
                errSum / count,
                (double) gradeMatch / count,
                points);
    }
}
