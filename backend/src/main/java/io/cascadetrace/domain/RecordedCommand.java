package io.cascadetrace.domain;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RecordedCommand(
        @Min(0) @Max(420) int second,
        @NotBlank @Pattern(regexp = "reroute|shed|mobile|prioritize|verify|repair") String commandId,
        @Size(max = 32) String reportId,
        @Min(0) int insertionOrder) {}
