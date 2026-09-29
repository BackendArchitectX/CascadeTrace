package io.cascadetrace.api;

import io.cascadetrace.domain.ArchiveStatsResponse;
import io.cascadetrace.domain.EvidencePackageResponse;
import io.cascadetrace.domain.RunComparisonResponse;
import io.cascadetrace.domain.SimulationRunDetailResponse;
import io.cascadetrace.domain.SimulationRunPageResponse;
import io.cascadetrace.service.EvidencePackageService;
import io.cascadetrace.service.SimulationRunService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/runs")
public class SimulationRunController {
    private final SimulationRunService service;
    private final EvidencePackageService evidencePackageService;

    public SimulationRunController(
            SimulationRunService service,
            EvidencePackageService evidencePackageService) {
        this.service = service;
        this.evidencePackageService = evidencePackageService;
    }

    @GetMapping
    public SimulationRunPageResponse list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return service.list(page, size);
    }

    @GetMapping("/stats")
    public ArchiveStatsResponse stats() {
        return service.stats();
    }

    @GetMapping("/compare")
    public RunComparisonResponse compare(
            @RequestParam UUID left,
            @RequestParam UUID right) {
        return service.compare(left, right);
    }

    @GetMapping("/{id}")
    public SimulationRunDetailResponse get(@PathVariable UUID id) {
        return service.get(id);
    }

    @GetMapping("/{id}/evidence")
    public EvidencePackageResponse evidence(@PathVariable UUID id) {
        return evidencePackageService.export(id);
    }

    @PostMapping("/{id}/verify")
    public SimulationRunDetailResponse reverify(@PathVariable UUID id) {
        return service.reverify(id);
    }
}
