package io.cascadetrace.api;

import io.cascadetrace.domain.ReplayEvaluation;
import io.cascadetrace.domain.ReplayRequest;
import io.cascadetrace.service.ReplayVerificationService;
import io.cascadetrace.service.SimulationRunService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class ReplayController {
    private final ReplayVerificationService verificationService;
    private final SimulationRunService runService;

    public ReplayController(ReplayVerificationService verificationService, SimulationRunService runService) {
        this.verificationService = verificationService;
        this.runService = runService;
    }

    @PostMapping("/replay")
    public ReplayEvaluation replay(@Valid @RequestBody ReplayRequest request) {
        ReplayEvaluation evaluation = verificationService.verify(request);
        runService.record(request, evaluation);
        return evaluation;
    }
}
