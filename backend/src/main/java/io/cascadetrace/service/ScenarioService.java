package io.cascadetrace.service;

import io.cascadetrace.domain.ScenarioMetadata;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class ScenarioService {
    public ScenarioMetadata metadata() {
        return new ScenarioMetadata(
                "CITY//01",
                "1.0.0",
                "Substation S14 loses 180 MW during peak demand",
                420,
                60,
                180,
                List.of("Power", "Telecom", "Traffic", "Water", "Hospital", "Emergency Services"),
                List.of("Reroute Grid Capacity", "Shed Non-Critical Load", "Deploy Mobile Generator", "Prioritize Emergency Telecom Traffic", "Verify Uncertain Field Report", "Dispatch Repair Team"));
    }
}
