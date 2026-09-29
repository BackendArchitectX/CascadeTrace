package io.cascadetrace.service;

import io.cascadetrace.domain.ScenarioManifestResponse;
import io.cascadetrace.domain.ScenarioMetadata;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;

@Service
public class ScenarioService {
    private static final ScenarioMetadata CITY01 = new ScenarioMetadata(
            "CITY//01",
            "1.0.0",
            "Substation S14 loses 180 MW during peak demand",
            420,
            60,
            180,
            List.of("Power", "Telecom", "Traffic", "Water", "Hospital", "Emergency Services"),
            List.of(
                    "Reroute Grid Capacity",
                    "Shed Non-Critical Load",
                    "Deploy Mobile Generator",
                    "Prioritize Emergency Telecom Traffic",
                    "Verify Uncertain Field Report",
                    "Dispatch Repair Team"));

    private static final List<String> CITY01_TAGS = List.of(
            "critical-infrastructure",
            "grid-failure",
            "dependency-cascade",
            "incident-command");

    public ScenarioMetadata metadata() {
        return CITY01;
    }

    public List<ScenarioManifestResponse> catalog() {
        return List.of(toManifest(CITY01));
    }

    public ScenarioManifestResponse manifest(String id) {
        if (!"CITY01".equals(normalize(id))) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Scenario not found: " + id);
        }
        return toManifest(CITY01);
    }

    private ScenarioManifestResponse toManifest(ScenarioMetadata metadata) {
        return new ScenarioManifestResponse(
                metadata.id(),
                "CITY01",
                "Seven Minutes to Cascade",
                "OPERATIONAL",
                true,
                metadata.engineVersion(),
                manifestHash(metadata),
                metadata.incident(),
                metadata.authoritativeDurationSeconds(),
                metadata.presentationDurationSeconds(),
                metadata.incidentLossMw(),
                metadata.systems(),
                metadata.interventions(),
                CITY01_TAGS);
    }

    private String normalize(String id) {
        if (id == null) return "";
        return id.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
    }

    private String manifestHash(ScenarioMetadata metadata) {
        String canonical = String.join("|",
                metadata.id(),
                metadata.engineVersion(),
                metadata.incident(),
                Integer.toString(metadata.authoritativeDurationSeconds()),
                Integer.toString(metadata.presentationDurationSeconds()),
                Integer.toString(metadata.incidentLossMw()),
                String.join(",", metadata.systems()),
                String.join(",", metadata.interventions()));
        return sha256(canonical);
    }

    private String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }
}
