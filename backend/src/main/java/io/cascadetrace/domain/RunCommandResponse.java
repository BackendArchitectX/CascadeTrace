package io.cascadetrace.domain;

public record RunCommandResponse(
        int second,
        String commandId,
        String reportId,
        int insertionOrder) {}
