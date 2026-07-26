package com.airvision.backend.prediction;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.offset;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.airvision.backend.dashboard.GradeProperties;
import com.airvision.backend.prediction.dto.PredictionAccuracyResponse;
import com.airvision.backend.site.ObservationSite;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class PredictionAccuracyServiceTest {

    private PredictionRepository repository;
    private PredictionAccuracyService service;
    private final ObservationSite site =
            new ObservationSite("연수송도", 37.3925, 126.635, null, "도시대기", null);
    private final AiModel resnet = new AiModel("resnet18_multimodal_v1", "resnet18", "v1", "p");
    private final AiModel swin = new AiModel("swin_multimodal_v1", "swin_t", "v1", "p");

    @BeforeEach
    void setUp() {
        repository = mock(PredictionRepository.class);
        GradeProperties grades = new GradeProperties(List.of(
                new GradeProperties.Grade("좋음", 15.0),
                new GradeProperties.Grade("보통", 35.0),
                new GradeProperties.Grade("나쁨", 75.0),
                new GradeProperties.Grade("매우나쁨", null)));
        service = new PredictionAccuracyService(repository, grades);
    }

    private Prediction prediction(AiModel model, double predicted, double actual) {
        return new Prediction(site, null, model,
                Instant.parse("2026-07-26T00:00:00Z"), actual, predicted, "좋음");
    }

    @Test
    void 모델별로_MAE_RMSE_평균오차_등급일치율을_집계한다() {
        when(repository.findAllWithActual()).thenReturn(List.of(
                prediction(resnet, 10.0, 12.0),   // 오차 -2, 좋음=좋음 일치
                prediction(resnet, 20.0, 14.0),   // 오차 +6, 보통≠좋음 불일치
                prediction(swin, 40.0, 38.0)));   // 오차 +2, 나쁨=나쁨 일치

        PredictionAccuracyResponse res = service.report();

        assertThat(res.totalWithActual()).isEqualTo(3);
        assertThat(res.models()).hasSize(2);
        // 건수 내림차순: resnet(2) → swin(1)
        PredictionAccuracyResponse.ModelAccuracy first = res.models().get(0);
        assertThat(first.modelName()).isEqualTo("resnet18_multimodal_v1");
        assertThat(first.count()).isEqualTo(2);
        assertThat(first.mae()).isCloseTo(4.0, offset(1e-9));
        assertThat(first.rmse()).isCloseTo(Math.sqrt(20.0), offset(1e-9));
        assertThat(first.meanError()).isCloseTo(2.0, offset(1e-9));
        assertThat(first.gradeAccuracy()).isCloseTo(0.5, offset(1e-9));
        PredictionAccuracyResponse.ModelAccuracy second = res.models().get(1);
        assertThat(second.modelName()).isEqualTo("swin_multimodal_v1");
        assertThat(second.gradeAccuracy()).isCloseTo(1.0, offset(1e-9));
        assertThat(second.points()).singleElement()
                .satisfies(p -> {
                    assertThat(p.predictedPm25()).isEqualTo(40.0);
                    assertThat(p.actualPm25()).isEqualTo(38.0);
                    assertThat(p.siteName()).isEqualTo("연수송도");
                });
    }

    @Test
    void 실측_기록이_없으면_빈_목록을_반환한다() {
        when(repository.findAllWithActual()).thenReturn(List.of());

        PredictionAccuracyResponse res = service.report();

        assertThat(res.totalWithActual()).isZero();
        assertThat(res.models()).isEmpty();
    }

    @Test
    void 산점도_점은_모델당_상한까지만_담고_집계는_전체_기준이다() {
        List<Prediction> many = new ArrayList<>();
        for (int i = 0; i < PredictionAccuracyService.POINT_LIMIT + 5; i++) {
            many.add(prediction(resnet, 11.0, 10.0)); // 오차 +1 균일
        }
        when(repository.findAllWithActual()).thenReturn(many);

        PredictionAccuracyResponse res = service.report();

        PredictionAccuracyResponse.ModelAccuracy model = res.models().get(0);
        assertThat(model.count()).isEqualTo(PredictionAccuracyService.POINT_LIMIT + 5);
        assertThat(model.points()).hasSize(PredictionAccuracyService.POINT_LIMIT);
        assertThat(model.mae()).isCloseTo(1.0, offset(1e-9));
    }
}
