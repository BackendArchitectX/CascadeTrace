package io.cascadetrace.domain;

import java.time.Instant;

public record EvidencePackageResponse(
        String schemaVersion,
        Instant exportedAt,
        ScenarioManifestResponse scenario,
        SimulationRunDetailResponse run,
        String evidenceHash) {}
