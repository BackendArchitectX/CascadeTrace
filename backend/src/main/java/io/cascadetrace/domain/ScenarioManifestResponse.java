package io.cascadetrace.domain;

import java.util.List;

public record ScenarioManifestResponse(
        String id,
        String key,
        String title,
        String status,
        boolean operational,
        String engineVersion,
        String manifestHash,
        String incident,
        int authoritativeDurationSeconds,
        int presentationDurationSeconds,
        int incidentLossMw,
        List<String> systems,
        List<String> interventions,
        List<String> tags) {}
