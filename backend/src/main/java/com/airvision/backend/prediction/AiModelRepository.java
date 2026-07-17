package com.airvision.backend.prediction;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AiModelRepository extends JpaRepository<AiModel, Long> {

    Optional<AiModel> findByModelNameAndVersion(String modelName, String version);
}
