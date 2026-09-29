package io.cascadetrace.service;

import io.cascadetrace.domain.ArchiveStatsResponse;
import io.cascadetrace.domain.RecordedCommand;
import io.cascadetrace.domain.ReplayEvaluation;
import io.cascadetrace.domain.ReplayRequest;
import io.cascadetrace.domain.ReplaySummary;
import io.cascadetrace.domain.RunCommandResponse;
import io.cascadetrace.domain.RunComparisonResponse;
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
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
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
    public ArchiveStatsResponse stats() {
        List<SimulationRunEntity> runs = repository.findAll();
        if (runs.isEmpty()) {
            return new ArchiveStatsResponse(0, 0, 0, 0, 0.0, null, 0.0);
        }

        long verifiedRuns = runs.stream().filter(SimulationRunEntity::isVerified).count();
        long recoveredRuns = runs.stream().filter(run -> run.getRecoveryTime() != null).count();
        long decisionDebtRuns = runs.stream().filter(SimulationRunEntity::isDecisionDebt).count();
        double averageFinalDeficit = runs.stream().mapToInt(SimulationRunEntity::getFinalDeficit).average().orElse(0.0);
        Integer bestFinalDeficit = runs.stream().mapToInt(SimulationRunEntity::getFinalDeficit).min().orElse(0);
        double averageCommandCount = runs.stream().mapToInt(SimulationRunEntity::getCommandCount).average().orElse(0.0);

        return new ArchiveStatsResponse(
                runs.size(),
                verifiedRuns,
                recoveredRuns,
                decisionDebtRuns,
                averageFinalDeficit,
                bestFinalDeficit,
                averageCommandCount);
    }

    @Transactional(readOnly = true)
    public SimulationRunDetailResponse get(UUID id) {
        return toDetail(findDetail(id));
    }

    @Transactional(readOnly = true)
    public RunComparisonResponse compare(UUID leftId, UUID rightId) {
        if (leftId.equals(rightId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose two different simulation runs");
        }

        SimulationRunEntity leftEntity = findDetail(leftId);
        SimulationRunEntity rightEntity = findDetail(rightId);
        if (!leftEntity.getScenarioId().equals(rightEntity.getScenarioId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Simulation runs belong to different scenarios");
        }

        SimulationRunDetailResponse left = toDetail(leftEntity);
        SimulationRunDetailResponse right = toDetail(rightEntity);
        Set<String> leftCommands = new LinkedHashSet<>(commandKeys(leftEntity));
        Set<String> rightCommands = new LinkedHashSet<>(commandKeys(rightEntity));

        Set<String> onlyLeft = new LinkedHashSet<>(leftCommands);
        onlyLeft.removeAll(rightCommands);
        Set<String> onlyRight = new LinkedHashSet<>(rightCommands);
        onlyRight.removeAll(leftCommands);

        return new RunComparisonResponse(
                left,
                right,
                right.serverEvaluation().finalDeficit() - left.serverEvaluation().finalDeficit(),
                right.serverEvaluation().cascadeEvents() - left.serverEvaluation().cascadeEvents(),
                nullableDelta(right.serverEvaluation().recoveryTime(), left.serverEvaluation().recoveryTime()),
                nullableDelta(right.serverEvaluation().firstStressed(), left.serverEvaluation().firstStressed()),
                nullableDelta(right.serverEvaluation().firstDegraded(), left.serverEvaluation().firstDegraded()),
                right.commandCount() - left.commandCount(),
                List.copyOf(onlyLeft),
                List.copyOf(onlyRight));
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

    private List<String> commandKeys(SimulationRunEntity entity) {
        return entity.getCommands().stream()
                .map(command -> command.getCommandId()
                        + (command.getReportId() == null ? "" : ":" + command.getReportId())
                        + "@" + command.getSecond() + "s")
                .toList();
    }

    private Integer nullableDelta(Integer right, Integer left) {
        return right == null || left == null ? null : right - left;
    }
}
