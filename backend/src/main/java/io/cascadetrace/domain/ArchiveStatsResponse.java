package io.cascadetrace.domain;

public record ArchiveStatsResponse(
        long totalRuns,
        long verifiedRuns,
        long recoveredRuns,
        long decisionDebtRuns,
        double averageFinalDeficit,
        Integer bestFinalDeficit,
        double averageCommandCount) {}
