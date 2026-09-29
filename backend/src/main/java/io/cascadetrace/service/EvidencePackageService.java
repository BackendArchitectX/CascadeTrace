package io.cascadetrace.service;

import io.cascadetrace.domain.EvidencePackageResponse;
import io.cascadetrace.domain.RunCommandResponse;
import io.cascadetrace.domain.ScenarioManifestResponse;
import io.cascadetrace.domain.SimulationRunDetailResponse;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class EvidencePackageService {
    private static final String SCHEMA_VERSION = "1.0";

    private final SimulationRunService runService;
    private final ScenarioService scenarioService;

    public EvidencePackageService(SimulationRunService runService, ScenarioService scenarioService) {
        this.runService = runService;
        this.scenarioService = scenarioService;
    }

    public EvidencePackageResponse export(UUID runId) {
        SimulationRunDetailResponse run = runService.get(runId);
        ScenarioManifestResponse scenario = scenarioService.manifest(run.scenarioId());
        return new EvidencePackageResponse(
                SCHEMA_VERSION,
                Instant.now(),
                scenario,
                run,
                evidenceHash(scenario, run));
    }

    private String evidenceHash(ScenarioManifestResponse scenario, SimulationRunDetailResponse run) {
        String commands = run.commands().stream()
                .map(this::canonicalCommand)
                .collect(Collectors.joining(";"));

        String canonical = String.join("|",
                "cascadetrace-evidence",
                SCHEMA_VERSION,
                run.id().toString(),
                run.scenarioId(),
                run.recordedAt().toString(),
                scenario.manifestHash(),
                Integer.toString(run.commandCount()),
                commands,
                Objects.toString(run.clientSummary().firstStressed(), ""),
                Objects.toString(run.clientSummary().firstDegraded(), ""),
                Objects.toString(run.clientSummary().recoveryTime(), ""),
                Integer.toString(run.clientSummary().finalDeficit()),
                Objects.toString(run.serverEvaluation().firstStressed(), ""),
                Objects.toString(run.serverEvaluation().firstDegraded(), ""),
                Objects.toString(run.serverEvaluation().recoveryTime(), ""),
                Integer.toString(run.serverEvaluation().finalDeficit()),
                Integer.toString(run.serverEvaluation().cascadeEvents()),
                Boolean.toString(run.serverEvaluation().decisionDebt()),
                Boolean.toString(run.serverEvaluation().verified()),
                run.serverEvaluation().fingerprint());

        return sha256(canonical);
    }

    private String canonicalCommand(RunCommandResponse command) {
        return command.second()
                + ":" + command.insertionOrder()
                + ":" + command.commandId()
                + ":" + Objects.toString(command.reportId(), "");
    }

    private String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }
}
