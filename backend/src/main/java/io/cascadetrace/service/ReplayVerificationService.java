package io.cascadetrace.service;

import io.cascadetrace.domain.RecordedCommand;
import io.cascadetrace.domain.ReplayEvaluation;
import io.cascadetrace.domain.ReplayRequest;
import io.cascadetrace.domain.ReplaySummary;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Objects;

@Service
public class ReplayVerificationService {
    private final DeterministicReplayEngine engine = new DeterministicReplayEngine();

    public ReplayEvaluation verify(ReplayRequest request) {
        ReplayEvaluation replay = engine.replay(request.commands());
        ReplaySummary client = request.clientSummary();
        boolean verified = client != null
                && Objects.equals(client.firstStressed(), replay.firstStressed())
                && Objects.equals(client.firstDegraded(), replay.firstDegraded())
                && Objects.equals(client.recoveryTime(), replay.recoveryTime())
                && client.finalDeficit() == replay.finalDeficit();
        String fingerprint = fingerprint(request, replay);
        return new ReplayEvaluation(
                replay.firstStressed(),
                replay.firstDegraded(),
                replay.recoveryTime(),
                replay.finalDeficit(),
                replay.cascadeEvents(),
                replay.decisionDebt(),
                verified,
                fingerprint);
    }

    private String fingerprint(ReplayRequest request, ReplayEvaluation replay) {
        StringBuilder canonical = new StringBuilder("CITY01|engine=1.0.0|");
        for (RecordedCommand command : request.commands()) {
            canonical.append(command.second()).append(':')
                    .append(command.insertionOrder()).append(':')
                    .append(command.commandId()).append(':')
                    .append(command.reportId() == null ? "-" : command.reportId())
                    .append('|');
        }
        canonical.append("result=")
                .append(replay.firstStressed()).append(':')
                .append(replay.firstDegraded()).append(':')
                .append(replay.recoveryTime()).append(':')
                .append(replay.finalDeficit()).append(':')
                .append(replay.cascadeEvents()).append(':')
                .append(replay.decisionDebt());
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256")
                    .digest(canonical.toString().getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }
}
