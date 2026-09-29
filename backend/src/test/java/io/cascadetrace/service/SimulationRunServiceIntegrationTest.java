package io.cascadetrace.service;

import io.cascadetrace.domain.RecordedCommand;
import io.cascadetrace.domain.ReplayRequest;
import io.cascadetrace.domain.ReplaySummary;
import io.cascadetrace.persistence.SimulationRunRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class SimulationRunServiceIntegrationTest {
    @Autowired
    private SimulationRunService runService;

    @Autowired
    private ReplayVerificationService verificationService;

    @Autowired
    private SimulationRunRepository repository;

    @BeforeEach
    void resetDatabase() {
        repository.deleteAll();
    }

    @Test
    void persistsCommandLedgerAndCanReverifyRun() {
        ReplayRequest request = new ReplayRequest(
                List.of(new RecordedCommand(0, "reroute", null, 0)),
                new ReplaySummary(76, null, null, 40));
        var evaluation = verificationService.verify(request);
        assertThat(evaluation.verified()).isTrue();

        var saved = runService.record(request, evaluation);
        var detail = runService.get(saved.id());

        assertThat(detail.commandCount()).isEqualTo(1);
        assertThat(detail.commands()).hasSize(1);
        assertThat(detail.commands().get(0).commandId()).isEqualTo("reroute");
        assertThat(detail.serverEvaluation().verified()).isTrue();

        var reverified = runService.reverify(saved.id());
        assertThat(reverified.serverEvaluation().fingerprint()).isEqualTo(evaluation.fingerprint());
        assertThat(reverified.serverEvaluation().verified()).isTrue();
    }

    @Test
    void suppressesImmediateStrictModeDuplicateButKeepsQueryableHistory() {
        ReplayRequest request = new ReplayRequest(
                List.of(),
                new ReplaySummary(40, 185, null, 120));
        var evaluation = verificationService.verify(request);

        runService.record(request, evaluation);
        runService.record(request, evaluation);

        var page = runService.list(0, 20);
        assertThat(page.totalElements()).isEqualTo(1);
        assertThat(page.items().get(0).finalDeficit()).isEqualTo(120);
    }
}
