package io.cascadetrace.service;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ScenarioServiceTest {
    private final ScenarioService service = new ScenarioService();

    @Test
    void exposesStableOperationalScenarioManifest() {
        var catalog = service.catalog();
        assertThat(catalog).hasSize(1);

        var manifest = service.manifest("CITY//01");
        assertThat(manifest.key()).isEqualTo("CITY01");
        assertThat(manifest.operational()).isTrue();
        assertThat(manifest.status()).isEqualTo("OPERATIONAL");
        assertThat(manifest.engineVersion()).isEqualTo("1.0.0");
        assertThat(manifest.manifestHash()).hasSize(64);
        assertThat(service.manifest("city01").manifestHash()).isEqualTo(manifest.manifestHash());
    }

    @Test
    void rejectsUnknownScenario() {
        assertThatThrownBy(() -> service.manifest("CITY//99"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Scenario not found");
    }
}
