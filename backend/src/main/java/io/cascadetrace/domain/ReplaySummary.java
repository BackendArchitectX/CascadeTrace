package io.cascadetrace.domain;

public record ReplaySummary(
        Integer firstStressed,
        Integer firstDegraded,
        Integer recoveryTime,
        int finalDeficit) {}
