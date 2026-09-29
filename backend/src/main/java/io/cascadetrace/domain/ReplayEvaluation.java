package io.cascadetrace.domain;

public record ReplayEvaluation(
        Integer firstStressed,
        Integer firstDegraded,
        Integer recoveryTime,
        int finalDeficit,
        int cascadeEvents,
        boolean decisionDebt,
        boolean verified,
        String fingerprint) {}
