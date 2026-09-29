CREATE INDEX idx_simulation_runs_fingerprint_recorded_at
    ON simulation_runs(fingerprint, recorded_at DESC);

CREATE INDEX idx_simulation_runs_scenario_recorded_at
    ON simulation_runs(scenario_id, recorded_at DESC);

CREATE INDEX idx_simulation_runs_decision_debt
    ON simulation_runs(decision_debt);
