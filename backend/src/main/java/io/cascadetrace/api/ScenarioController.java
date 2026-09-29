package io.cascadetrace.api;

import io.cascadetrace.domain.ScenarioMetadata;
import io.cascadetrace.service.ScenarioService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/scenario")
public class ScenarioController {
    private final ScenarioService service;
    public ScenarioController(ScenarioService service) { this.service = service; }
    @GetMapping public ScenarioMetadata getScenario() { return service.metadata(); }
}
