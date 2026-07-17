package com.airvision.backend.prediction;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;

/** AI 모델 메타데이터. config_json 컬럼은 현재 사용하지 않아 매핑을 생략한다. */
@Entity
@Table(name = "ai_models",
        uniqueConstraints = @UniqueConstraint(name = "uq_ai_models_name_version",
                columnNames = {"model_name", "version"}))
public class AiModel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "model_name", nullable = false, length = 100)
    private String modelName;

    @Column(nullable = false, length = 50)
    private String architecture;

    @Column(nullable = false, length = 30)
    private String version;

    @Column(name = "model_path", nullable = false, length = 500)
    private String modelPath;

    @Column(name = "is_active", nullable = false)
    private boolean active;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected AiModel() {
    }

    public AiModel(String modelName, String architecture, String version, String modelPath) {
        this.modelName = modelName;
        this.architecture = architecture;
        this.version = version;
        this.modelPath = modelPath;
        this.active = false;
    }

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public String getModelName() {
        return modelName;
    }

    public String getArchitecture() {
        return architecture;
    }

    public String getVersion() {
        return version;
    }

    public String getModelPath() {
        return modelPath;
    }

    public boolean isActive() {
        return active;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
