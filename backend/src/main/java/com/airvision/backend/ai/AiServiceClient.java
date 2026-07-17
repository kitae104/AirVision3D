package com.airvision.backend.ai;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.multipart.MultipartFile;

/** FastAPI AI 서비스 REST 클라이언트 (Spring → AI 단방향). */
@Component
public class AiServiceClient {

    private final RestClient restClient;

    public AiServiceClient(@Value("${airvision.ai-service.url}") String baseUrl) {
        // 기본 JDK HttpClient는 chunked+h2c 업그레이드로 전송해 uvicorn이 multipart를
        // 읽지 못하므로, Content-Length를 포함해 버퍼 전송하는 팩토리를 사용한다.
        var requestFactory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(java.time.Duration.ofSeconds(5));
        requestFactory.setReadTimeout(java.time.Duration.ofSeconds(120));
        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                .build();
    }

    /** AI 서비스 공통 응답 래퍼. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    record Envelope<T>(boolean success, T data, String message) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record PredictData(
            Double pm25,
            String grade,
            @JsonProperty("model_name") String modelName
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ModelInfo(
            @JsonProperty("model_name") String modelName,
            String architecture,
            Boolean pretrained
    ) {
    }

    /** 이미지 + 환경값으로 PM2.5 추론을 요청한다. */
    public PredictData predict(String modelName, MultipartFile image,
                               double temperature, double humidity, double windSpeed) {
        // reactive-streams 의존성 필요 (build.gradle 참고)
        org.springframework.http.client.MultipartBodyBuilder builder =
                new org.springframework.http.client.MultipartBodyBuilder();
        builder.part("image", image.getResource());
        builder.part("temperature", String.valueOf(temperature));
        builder.part("humidity", String.valueOf(humidity));
        builder.part("wind_speed", String.valueOf(windSpeed));

        try {
            Envelope<PredictData> response = restClient.post()
                    .uri("/models/{name}/predict", modelName)
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(builder.build())
                    .retrieve()
                    .body(new org.springframework.core.ParameterizedTypeReference<>() {
                    });
            if (response == null || !response.success() || response.data() == null) {
                throw new AiServiceException("AI 서비스가 올바른 응답을 반환하지 않았습니다");
            }
            return response.data();
        } catch (HttpStatusCodeException e) {
            throw new AiServiceException(
                    "AI 서비스 오류 (HTTP %d): %s".formatted(e.getStatusCode().value(),
                            e.getResponseBodyAsString()), e);
        } catch (RestClientException e) {
            throw new AiServiceUnavailableException(
                    "AI 서비스에 연결할 수 없습니다. ai-service 기동 여부를 확인하세요", e);
        }
    }

    /** 저장된 모델 목록 조회. 연결 불가 시 빈 목록 반환 (모델 메타 upsert 보조용). */
    public List<ModelInfo> listModels() {
        try {
            Envelope<List<ModelInfo>> response = restClient.get()
                    .uri("/models")
                    .retrieve()
                    .body(new org.springframework.core.ParameterizedTypeReference<>() {
                    });
            return response != null && response.data() != null ? response.data() : List.of();
        } catch (RestClientException e) {
            return List.of();
        }
    }

    /** 모델 성능지표 조회 (원본 JSON 구조 그대로 전달). */
    public Map<String, Object> modelMetrics(String modelName) {
        try {
            Envelope<Map<String, Object>> response = restClient.get()
                    .uri("/models/{name}/metrics", modelName)
                    .retrieve()
                    .body(new org.springframework.core.ParameterizedTypeReference<>() {
                    });
            if (response == null || response.data() == null) {
                throw new AiServiceException("성능지표 응답이 비어 있습니다");
            }
            return response.data();
        } catch (HttpStatusCodeException e) {
            throw new AiServiceException(
                    "AI 서비스 오류 (HTTP %d)".formatted(e.getStatusCode().value()), e);
        } catch (RestClientException e) {
            throw new AiServiceUnavailableException(
                    "AI 서비스에 연결할 수 없습니다. ai-service 기동 여부를 확인하세요", e);
        }
    }
}
