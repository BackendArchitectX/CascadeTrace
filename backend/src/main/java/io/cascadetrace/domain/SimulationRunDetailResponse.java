package io.cascadetrace.domain;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record SimulationRunDetailResponse(
        UUID id,
        String scenarioId,
        Instant recordedAt,
        int commandCount,
        List<RunCommandResponse> commands,
        ReplaySummary clientSummary,
        ReplayEvaluation serverEvaluation) {}
