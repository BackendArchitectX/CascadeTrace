package io.cascadetrace.api;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1")
public class HealthController {
    @GetMapping("/health")
    public Map<String, Object> health() {
        return Map.of(
                "status", "UP",
                "service", "cascadetrace-api",
                "version", "1.3.0",
                "deterministic", true,
                "persistence", "postgresql",
                "scenarioRegistry", true,
                "evidenceSchema", "1.0");
    }
}
