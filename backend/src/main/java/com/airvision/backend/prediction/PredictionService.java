package com.airvision.backend.prediction;

import com.airvision.backend.ai.AiServiceClient;
import com.airvision.backend.common.PageResponse;
import com.airvision.backend.observation.Observation;
import com.airvision.backend.observation.ObservationRepository;
import com.airvision.backend.prediction.dto.PredictionResponse;
import com.airvision.backend.site.ObservationSite;
import com.airvision.backend.site.SiteService;
import java.time.Instant;
import java.util.Map;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@Transactional(readOnly = true)
public class PredictionService {

    /** ai_models.version 기본값 (AI 서비스는 모델 디렉터리 단위로 관리하므로 단일 버전 사용). */
    static final String DEFAULT_MODEL_VERSION = "1";

    private final AiServiceClient aiClient;
    private final SiteService siteService;
    private final ObservationRepository observationRepository;
    private final AiModelRepository aiModelRepository;
    private final PredictionRepository predictionRepository;

    public PredictionService(AiServiceClient aiClient, SiteService siteService,
                             ObservationRepository observationRepository,
                             AiModelRepository aiModelRepository,
                             PredictionRepository predictionRepository) {
        this.aiClient = aiClient;
        this.siteService = siteService;
        this.observationRepository = observationRepository;
        this.aiModelRepository = aiModelRepository;
        this.predictionRepository = predictionRepository;
    }

    /** 이미지+환경값으로 AI 추론을 실행하고 결과를 predictions에 저장한다. */
    @Transactional
    public PredictionResponse run(Long siteId, String modelName, MultipartFile image,
                                  double temperature, double humidity, double windSpeed) {
        ObservationSite site = siteService.getSiteOrThrow(siteId);

        // 관측소 위경도·현재 시각을 함께 전달한다 (태양고도 특징 모델용, 미사용 모델은 무시)
        AiServiceClient.PredictData result =
                aiClient.predict(modelName, image, temperature, humidity, windSpeed,
                        site.getLatitude(), site.getLongitude(), Instant.now());

        AiModel model = aiModelRepository
                .findByModelNameAndVersion(modelName, DEFAULT_MODEL_VERSION)
                .orElseGet(() -> aiModelRepository.save(new AiModel(
                        modelName, resolveArchitecture(modelName), DEFAULT_MODEL_VERSION,
                        "data/models/" + modelName)));

        Double actualPm25 = observationRepository
                .findFirstBySite_IdOrderByObservedAtDesc(siteId)
                .map(Observation::getPm25)
                .orElse(null);

        Prediction prediction = new Prediction(
                site, null, model, Instant.now(),
                actualPm25, result.pm25(), result.grade());
        return PredictionResponse.from(predictionRepository.save(prediction));
    }

    public PageResponse<PredictionResponse> findRecent(Long siteId, int page, int size) {
        var pageable = PageRequest.of(page, size);
        var result = (siteId != null
                ? predictionRepository.findBySite_IdOrderByPredictedAtDesc(siteId, pageable)
                : predictionRepository.findAllByOrderByPredictedAtDesc(pageable))
                .map(PredictionResponse::from);
        return PageResponse.from(result);
    }

    /** AI 서비스 모델 성능지표 조회 (모델 성능 화면용 프록시). */
    public Map<String, Object> modelMetrics(String modelName) {
        return aiClient.modelMetrics(modelName);
    }

    private String resolveArchitecture(String modelName) {
        return aiClient.listModels().stream()
                .filter(m -> modelName.equals(m.modelName()))
                .map(AiServiceClient.ModelInfo::architecture)
                .findFirst()
                .orElse("unknown");
    }
}
