package com.airvision.backend.prediction;

import com.airvision.backend.site.ObservationSite;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * AI 예측 결과 엔티티.
 * image_id는 이미지 관리 기능(Phase 6) 도입 전까지 단순 컬럼으로 매핑한다.
 */
@Entity
@Table(name = "predictions")
public class Prediction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "site_id", nullable = false)
    private ObservationSite site;

    @Column(name = "image_id")
    private Long imageId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "model_id", nullable = false)
    private AiModel model;

    @Column(name = "predicted_at", nullable = false)
    private Instant predictedAt;

    @Column(name = "actual_pm25")
    private Double actualPm25;

    @Column(name = "predicted_pm25", nullable = false)
    private double predictedPm25;

    @Column(name = "predicted_grade", length = 20)
    private String predictedGrade;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected Prediction() {
    }

    public Prediction(ObservationSite site, Long imageId, AiModel model, Instant predictedAt,
                      Double actualPm25, double predictedPm25, String predictedGrade) {
        this.site = site;
        this.imageId = imageId;
        this.model = model;
        this.predictedAt = predictedAt;
        this.actualPm25 = actualPm25;
        this.predictedPm25 = predictedPm25;
        this.predictedGrade = predictedGrade;
    }

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public ObservationSite getSite() {
        return site;
    }

    public Long getImageId() {
        return imageId;
    }

    public AiModel getModel() {
        return model;
    }

    public Instant getPredictedAt() {
        return predictedAt;
    }

    public Double getActualPm25() {
        return actualPm25;
    }

    public double getPredictedPm25() {
        return predictedPm25;
    }

    public String getPredictedGrade() {
        return predictedGrade;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
