package io.cascadetrace.domain;

import java.util.List;

public record ScenarioMetadata(
        String id,
        String engineVersion,
        String incident,
        int authoritativeDurationSeconds,
        int presentationDurationSeconds,
        int incidentLossMw,
        List<String> systems,
        List<String> interventions) {}
