package io.cascadetrace.service;

import io.cascadetrace.domain.RecordedCommand;
import io.cascadetrace.domain.ReplayEvaluation;
import io.cascadetrace.domain.ReplayRequest;
import io.cascadetrace.domain.ReplaySummary;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ReplayVerificationServiceTest {
    private final ReplayVerificationService service = new ReplayVerificationService();

    @Test
    void verifiesMatchingClientSummaryAndProducesStableFingerprint() {
        List<RecordedCommand> commands = List.of(
                new RecordedCommand(0, "reroute", null, 0),
                new RecordedCommand(0, "mobile", null, 1));
        ReplayRequest request = new ReplayRequest(commands, new ReplaySummary(null, null, 40, 0));

        ReplayEvaluation first = service.verify(request);
        ReplayEvaluation second = service.verify(request);

        assertTrue(first.verified());
        assertEquals(64, first.fingerprint().length());
        assertEquals(first.fingerprint(), second.fingerprint());
    }

    @Test
    void rejectsMismatchedClientSummaryWithoutChangingServerReplay() {
        ReplayRequest request = new ReplayRequest(
                List.of(new RecordedCommand(0, "reroute", null, 0)),
                new ReplaySummary(null, null, null, 999));

        ReplayEvaluation result = service.verify(request);

        assertFalse(result.verified());
        assertEquals(76, result.firstStressed());
        assertNull(result.firstDegraded());
        assertEquals(40, result.finalDeficit());
    }
}
