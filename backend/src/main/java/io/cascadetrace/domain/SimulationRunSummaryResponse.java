package io.cascadetrace.domain;

import java.time.Instant;
import java.util.UUID;

public record SimulationRunSummaryResponse(
        UUID id,
        String scenarioId,
        Instant recordedAt,
        boolean verified,
        int finalDeficit,
        Integer recoveryTime,
        int cascadeEvents,
        boolean decisionDebt,
        int commandCount,
        String fingerprint) {}
