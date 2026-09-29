package io.cascadetrace.api;

import io.cascadetrace.domain.ReplayEvaluation;
import io.cascadetrace.domain.ReplayRequest;
import io.cascadetrace.service.ReplayVerificationService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class ReplayController {
    private final ReplayVerificationService service;
    public ReplayController(ReplayVerificationService service) { this.service = service; }

    @PostMapping("/replay")
    public ReplayEvaluation replay(@Valid @RequestBody ReplayRequest request) {
        return service.verify(request);
    }
}
