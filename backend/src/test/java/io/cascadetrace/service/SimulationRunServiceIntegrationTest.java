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
    private EvidencePackageService evidencePackageService;

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

    @Test
    void comparesRunsAndCalculatesArchiveStatistics() {
        ReplayRequest noAction = new ReplayRequest(
                List.of(),
                new ReplaySummary(40, 185, null, 120));
        ReplayRequest reroute = new ReplayRequest(
                List.of(new RecordedCommand(0, "reroute", null, 0)),
                new ReplaySummary(76, null, null, 40));

        var left = runService.record(noAction, verificationService.verify(noAction));
        var right = runService.record(reroute, verificationService.verify(reroute));

        var comparison = runService.compare(left.id(), right.id());
        assertThat(comparison.finalDeficitDelta()).isEqualTo(-80);
        assertThat(comparison.firstStressedDelta()).isEqualTo(36);
        assertThat(comparison.firstDegradedDelta()).isNull();
        assertThat(comparison.commandCountDelta()).isEqualTo(1);
        assertThat(comparison.commandsOnlyInRight()).containsExactly("reroute@0s");

        var stats = runService.stats();
        assertThat(stats.totalRuns()).isEqualTo(2);
        assertThat(stats.verifiedRuns()).isEqualTo(2);
        assertThat(stats.averageFinalDeficit()).isEqualTo(80.0);
        assertThat(stats.bestFinalDeficit()).isEqualTo(40);
        assertThat(stats.averageCommandCount()).isEqualTo(0.5);
    }

    @Test
    void exportsStableServerGeneratedEvidencePackage() {
        ReplayRequest request = new ReplayRequest(
                List.of(
                        new RecordedCommand(0, "reroute", null, 0),
                        new RecordedCommand(0, "mobile", null, 1)),
                new ReplaySummary(null, null, 40, 0));

        var saved = runService.record(request, verificationService.verify(request));
        var first = evidencePackageService.export(saved.id());
        var second = evidencePackageService.export(saved.id());

        assertThat(first.schemaVersion()).isEqualTo("1.0");
        assertThat(first.run().id()).isEqualTo(saved.id());
        assertThat(first.run().serverEvaluation().verified()).isTrue();
        assertThat(first.scenario().operational()).isTrue();
        assertThat(first.scenario().manifestHash()).hasSize(64);
        assertThat(first.evidenceHash()).hasSize(64);
        assertThat(second.evidenceHash()).isEqualTo(first.evidenceHash());
    }
}
