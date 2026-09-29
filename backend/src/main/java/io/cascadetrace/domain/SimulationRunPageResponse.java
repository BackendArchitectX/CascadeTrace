package io.cascadetrace.domain;

import java.util.List;

public record SimulationRunPageResponse(
        List<SimulationRunSummaryResponse> items,
        int page,
        int size,
        long totalElements,
        int totalPages) {}
