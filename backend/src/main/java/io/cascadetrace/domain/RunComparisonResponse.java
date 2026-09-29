package io.cascadetrace.domain;

import java.util.List;

public record RunComparisonResponse(
        SimulationRunDetailResponse left,
        SimulationRunDetailResponse right,
        Integer finalDeficitDelta,
        Integer cascadeEventsDelta,
        Integer recoveryTimeDelta,
        Integer firstStressedDelta,
        Integer firstDegradedDelta,
        int commandCountDelta,
        List<String> commandsOnlyInLeft,
        List<String> commandsOnlyInRight) {}
