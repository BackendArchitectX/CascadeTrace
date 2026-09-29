package io.cascadetrace.api;

import io.cascadetrace.domain.ScenarioManifestResponse;
import io.cascadetrace.service.ScenarioService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/scenarios")
public class ScenarioCatalogController {
    private final ScenarioService service;

    public ScenarioCatalogController(ScenarioService service) {
        this.service = service;
    }

    @GetMapping
    public List<ScenarioManifestResponse> catalog() {
        return service.catalog();
    }

    @GetMapping("/{id}")
    public ScenarioManifestResponse manifest(@PathVariable String id) {
        return service.manifest(id);
    }
}
