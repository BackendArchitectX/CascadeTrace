package io.cascadetrace.service;

import io.cascadetrace.domain.RecordedCommand;
import io.cascadetrace.domain.ReplayEvaluation;
import io.cascadetrace.domain.ReplayRequest;
import io.cascadetrace.domain.ReplaySummary;
import io.cascadetrace.domain.RunCommandResponse;
import io.cascadetrace.domain.SimulationRunDetailResponse;
import io.cascadetrace.domain.SimulationRunPageResponse;
import io.cascadetrace.domain.SimulationRunSummaryResponse;
import io.cascadetrace.persistence.RunCommandEntity;
import io.cascadetrace.persistence.SimulationRunEntity;
import io.cascadetrace.persistence.SimulationRunRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class SimulationRunService {
    private static final String SCENARIO_ID = "CITY01";
    private static final int MAX_PAGE_SIZE = 100;
    private static final long DEDUPLICATION_WINDOW_SECONDS = 3;

    private final SimulationRunRepository repository;
    private final ReplayVerificationService verificationService;

    public SimulationRunService(SimulationRunRepository repository, ReplayVerificationService verificationService) {
        this.repository = repository;
        this.verificationService = verificationService;
    }

    @Transactional
    public SimulationRunSummaryResponse record(ReplayRequest request, ReplayEvaluation evaluation) {
        Instant now = Instant.now();
        var duplicate = repository.findFirstByFingerprintAndRecordedAtAfterOrderByRecordedAtDesc(
                evaluation.fingerprint(), now.minusSeconds(DEDUPLICATION_WINDOW_SECONDS));
        if (duplicate.isPresent()) {
            return toSummary(duplicate.get());
        }

        SimulationRunEntity entity = new SimulationRunEntity(
                UUID.randomUUID(), SCENARIO_ID, now, request.clientSummary(), evaluation);
        request.commands().forEach(entity::addCommand);
        return toSummary(repository.save(entity));
    }

    @Transactional(readOnly = true)
    public SimulationRunPageResponse list(int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(size, MAX_PAGE_SIZE));
        Page<SimulationRunEntity> result = repository.findAllByOrderByRecordedAtDesc(PageRequest.of(safePage, safeSize));
        return new SimulationRunPageResponse(
                result.getContent().stream().map(this::toSummary).toList(),
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages());
    }

    @Transactional(readOnly = true)
    public SimulationRunDetailResponse get(UUID id) {
        return toDetail(findDetail(id));
    }

    @Transactional
    public SimulationRunDetailResponse reverify(UUID id) {
        SimulationRunEntity entity = findDetail(id);
        List<RecordedCommand> commands = entity.getCommands().stream().map(this::toRecordedCommand).toList();
        ReplaySummary clientSummary = clientSummary(entity);
        ReplayEvaluation evaluation = verificationService.verify(new ReplayRequest(commands, clientSummary));
        entity.applyEvaluation(evaluation);
        return toDetail(repository.save(entity));
    }

    private SimulationRunEntity findDetail(UUID id) {
        return repository.findDetailById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Simulation run not found: " + id));
    }

    private SimulationRunSummaryResponse toSummary(SimulationRunEntity entity) {
        return new SimulationRunSummaryResponse(
                entity.getId(),
                entity.getScenarioId(),
                entity.getRecordedAt(),
                entity.isVerified(),
                entity.getFinalDeficit(),
                entity.getRecoveryTime(),
                entity.getCascadeEvents(),
                entity.isDecisionDebt(),
                entity.getCommandCount(),
                entity.getFingerprint());
    }

    private SimulationRunDetailResponse toDetail(SimulationRunEntity entity) {
        List<RunCommandResponse> commands = entity.getCommands().stream()
                .map(command -> new RunCommandResponse(
                        command.getSecond(), command.getCommandId(), command.getReportId(), command.getInsertionOrder()))
                .toList();
        return new SimulationRunDetailResponse(
                entity.getId(),
                entity.getScenarioId(),
                entity.getRecordedAt(),
                entity.getCommandCount(),
                commands,
                clientSummary(entity),
                serverEvaluation(entity));
    }

    private ReplaySummary clientSummary(SimulationRunEntity entity) {
        return new ReplaySummary(
                entity.getClientFirstStressed(),
                entity.getClientFirstDegraded(),
                entity.getClientRecoveryTime(),
                entity.getClientFinalDeficit());
    }

    private ReplayEvaluation serverEvaluation(SimulationRunEntity entity) {
        return new ReplayEvaluation(
                entity.getFirstStressed(),
                entity.getFirstDegraded(),
                entity.getRecoveryTime(),
                entity.getFinalDeficit(),
                entity.getCascadeEvents(),
                entity.isDecisionDebt(),
                entity.isVerified(),
                entity.getFingerprint());
    }

    private RecordedCommand toRecordedCommand(RunCommandEntity command) {
        return new RecordedCommand(
                command.getSecond(),
                command.getCommandId(),
                command.getReportId(),
                command.getInsertionOrder());
    }
}
