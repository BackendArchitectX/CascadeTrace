package io.cascadetrace.domain;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public record ReplayRequest(
        @NotNull @Size(max = 64) List<@Valid RecordedCommand> commands,
        @Valid ReplaySummary clientSummary) {}
