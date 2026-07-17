package com.airvision.backend.health;

import com.airvision.backend.common.ApiResponse;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 서비스 생존 확인용 헬스체크 API.
 * DB 등 외부 의존성 없이 애플리케이션 기동 여부만 확인한다. (Phase 1)
 */
@RestController
@RequestMapping("/api/health")
public class HealthController {

    @GetMapping
    public ApiResponse<Map<String, String>> health() {
        return ApiResponse.ok(Map.of(
                "status", "UP",
                "service", "airvision-backend"
        ));
    }
}
