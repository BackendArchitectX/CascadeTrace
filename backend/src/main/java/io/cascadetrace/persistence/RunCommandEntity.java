package io.cascadetrace.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "run_commands")
public class RunCommandEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "run_id", nullable = false)
    private SimulationRunEntity run;

    @Column(name = "simulation_second", nullable = false)
    private int second;

    @Column(name = "command_id", nullable = false, length = 32)
    private String commandId;

    @Column(name = "report_id", length = 32)
    private String reportId;

    @Column(name = "insertion_order", nullable = false)
    private int insertionOrder;

    protected RunCommandEntity() {
    }

    RunCommandEntity(SimulationRunEntity run, int second, String commandId, String reportId, int insertionOrder) {
        this.run = run;
        this.second = second;
        this.commandId = commandId;
        this.reportId = reportId;
        this.insertionOrder = insertionOrder;
    }

    public int getSecond() { return second; }
    public String getCommandId() { return commandId; }
    public String getReportId() { return reportId; }
    public int getInsertionOrder() { return insertionOrder; }
}
