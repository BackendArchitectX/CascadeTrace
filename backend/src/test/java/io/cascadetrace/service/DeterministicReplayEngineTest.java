package io.cascadetrace.service;

import io.cascadetrace.domain.RecordedCommand;
import io.cascadetrace.domain.ReplayEvaluation;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class DeterministicReplayEngineTest {
    private final DeterministicReplayEngine engine = new DeterministicReplayEngine();
    private RecordedCommand c(String id, int order) { return new RecordedCommand(0, id, null, order); }

    @Test void noActionBaseline() {
        ReplayEvaluation r = engine.replay(List.of());
        assertEquals(Integer.valueOf(40), r.firstStressed()); assertEquals(Integer.valueOf(185), r.firstDegraded());
        assertNull(r.recoveryTime()); assertEquals(120, r.finalDeficit());
    }
    @Test void rerouteSeparatesStrategy() {
        ReplayEvaluation r = engine.replay(List.of(c("reroute", 0)));
        assertEquals(Integer.valueOf(76), r.firstStressed()); assertNull(r.firstDegraded());
        assertNull(r.recoveryTime()); assertEquals(40, r.finalDeficit());
    }
    @Test void reroutePlusMobileRecovers() {
        ReplayEvaluation r = engine.replay(List.of(c("reroute", 0), c("mobile", 1)));
        assertNull(r.firstStressed()); assertNull(r.firstDegraded());
        assertEquals(Integer.valueOf(40), r.recoveryTime()); assertEquals(0, r.finalDeficit());
    }
    @Test void shedLoadCreatesDelayedDebt() {
        ReplayEvaluation r = engine.replay(List.of(c("shed", 0)));
        assertEquals(Integer.valueOf(180), r.firstStressed()); assertEquals(Integer.valueOf(198), r.firstDegraded());
        assertNull(r.recoveryTime()); assertEquals(30, r.finalDeficit()); assertTrue(r.decisionDebt());
    }
}
