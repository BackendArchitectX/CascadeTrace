package io.cascadetrace.persistence;

import io.cascadetrace.domain.RecordedCommand;
import io.cascadetrace.domain.ReplayEvaluation;
import io.cascadetrace.domain.ReplaySummary;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "simulation_runs")
public class SimulationRunEntity {
    @Id
    private UUID id;

    @Column(name = "scenario_id", nullable = false, length = 64)
    private String scenarioId;

    @Column(name = "recorded_at", nullable = false)
    private Instant recordedAt;

    @Column(name = "first_stressed")
    private Integer firstStressed;

    @Column(name = "first_degraded")
    private Integer firstDegraded;

    @Column(name = "recovery_time")
    private Integer recoveryTime;

    @Column(name = "final_deficit", nullable = false)
    private int finalDeficit;

    @Column(name = "cascade_events", nullable = false)
    private int cascadeEvents;

    @Column(name = "decision_debt", nullable = false)
    private boolean decisionDebt;

    @Column(name = "verified", nullable = false)
    private boolean verified;

    @Column(name = "fingerprint", nullable = false, length = 64)
    private String fingerprint;

    @Column(name = "client_first_stressed")
    private Integer clientFirstStressed;

    @Column(name = "client_first_degraded")
    private Integer clientFirstDegraded;

    @Column(name = "client_recovery_time")
    private Integer clientRecoveryTime;

    @Column(name = "client_final_deficit", nullable = false)
    private int clientFinalDeficit;

    @Column(name = "command_count", nullable = false)
    private int commandCount;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    @OneToMany(mappedBy = "run", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("second ASC, insertionOrder ASC")
    private List<RunCommandEntity> commands = new ArrayList<>();

    protected SimulationRunEntity() {
    }

    public SimulationRunEntity(UUID id, String scenarioId, Instant recordedAt, ReplaySummary clientSummary, ReplayEvaluation evaluation) {
        this.id = id;
        this.scenarioId = scenarioId;
        this.recordedAt = recordedAt;
        this.clientFirstStressed = clientSummary == null ? null : clientSummary.firstStressed();
        this.clientFirstDegraded = clientSummary == null ? null : clientSummary.firstDegraded();
        this.clientRecoveryTime = clientSummary == null ? null : clientSummary.recoveryTime();
        this.clientFinalDeficit = clientSummary == null ? evaluation.finalDeficit() : clientSummary.finalDeficit();
        applyEvaluation(evaluation);
    }

    public void addCommand(RecordedCommand command) {
        commands.add(new RunCommandEntity(this, command.second(), command.commandId(), command.reportId(), command.insertionOrder()));
        commandCount = commands.size();
    }

    public void applyEvaluation(ReplayEvaluation evaluation) {
        firstStressed = evaluation.firstStressed();
        firstDegraded = evaluation.firstDegraded();
        recoveryTime = evaluation.recoveryTime();
        finalDeficit = evaluation.finalDeficit();
        cascadeEvents = evaluation.cascadeEvents();
        decisionDebt = evaluation.decisionDebt();
        verified = evaluation.verified();
        fingerprint = evaluation.fingerprint();
    }

    public UUID getId() { return id; }
    public String getScenarioId() { return scenarioId; }
    public Instant getRecordedAt() { return recordedAt; }
    public Integer getFirstStressed() { return firstStressed; }
    public Integer getFirstDegraded() { return firstDegraded; }
    public Integer getRecoveryTime() { return recoveryTime; }
    public int getFinalDeficit() { return finalDeficit; }
    public int getCascadeEvents() { return cascadeEvents; }
    public boolean isDecisionDebt() { return decisionDebt; }
    public boolean isVerified() { return verified; }
    public String getFingerprint() { return fingerprint; }
    public Integer getClientFirstStressed() { return clientFirstStressed; }
    public Integer getClientFirstDegraded() { return clientFirstDegraded; }
    public Integer getClientRecoveryTime() { return clientRecoveryTime; }
    public int getClientFinalDeficit() { return clientFinalDeficit; }
    public int getCommandCount() { return commandCount; }
    public List<RunCommandEntity> getCommands() { return Collections.unmodifiableList(commands); }
}
