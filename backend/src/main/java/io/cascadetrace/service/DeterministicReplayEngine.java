package io.cascadetrace.service;

import io.cascadetrace.domain.RecordedCommand;
import io.cascadetrace.domain.ReplayEvaluation;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public final class DeterministicReplayEngine {
    public static final int DURATION_SECONDS = 420;

    private enum Status { NORMAL, STRESSED, DEGRADED, CRITICAL }

    private static final class ActiveCommand {
        private final String id;
        private final int finish;
        private ActiveCommand(String id, int finish) { this.id = id; this.finish = finish; }
    }

    private static final class Model {
        int time;
        int generation = 920;
        int demand = 1040;
        int reserve = 72;
        int mobile = 2;
        int teams = 2;
        int slots = 2;
        int intel = 2;
        boolean debtActive;
        boolean priorityTelecom;
        Integer backupDepletedAt;
        Integer recoveryTime;
        int telecomRuntime;
        double telecomCapacity = 100;
        double trafficThroughput = 88;
        double trafficSignal = 96;
        double waterPressure = 91;
        double waterPumps = 94;
        double emergencyResponse = 84;
        double emergencyComms = 92;
        double hospitalTreatment = 90;
        double hospitalBackup = 82;
        double exposureTelecom;
        double exposureTraffic;
        double exposureWater;
        double exposureEmergency;
        double exposureHospital;
        int cascadeEvents;
        Integer firstStressed;
        Integer firstDegraded;
        final List<ActiveCommand> active = new ArrayList<>();
        final Set<String> completed = new HashSet<>();
    }

    public ReplayEvaluation replay(List<RecordedCommand> commands) {
        Model state = new Model();
        List<RecordedCommand> ordered = new ArrayList<>(commands == null ? List.of() : commands);
        ordered.sort(Comparator.comparingInt(RecordedCommand::second).thenComparingInt(RecordedCommand::insertionOrder));
        int cursor = 0;
        while (state.time < DURATION_SECONDS) {
            while (cursor < ordered.size() && ordered.get(cursor).second() == state.time) {
                applyCommand(state, ordered.get(cursor));
                cursor++;
            }
            step(state);
        }
        return new ReplayEvaluation(state.firstStressed, state.firstDegraded, state.recoveryTime,
                deficit(state), state.cascadeEvents, state.debtActive || state.backupDepletedAt != null, true, null);
    }

    private void applyCommand(Model state, RecordedCommand command) {
        String id = command.commandId();
        if (id == null || state.slots < 1 || state.active.size() >= 2 || state.active.stream().anyMatch(a -> a.id.equals(id))) return;
        if (!id.equals("verify") && !id.equals("repair") && state.completed.contains(id)) return;
        int duration;
        switch (id) {
            case "reroute" -> { if (state.reserve < 12) return; state.reserve -= 12; duration = 35; }
            case "shed" -> { if (deficit(state) <= 0) return; duration = 25; }
            case "mobile" -> { if (state.mobile < 1) return; state.mobile--; duration = 40; }
            case "prioritize" -> duration = 30;
            case "verify" -> { if (state.intel < 1) return; state.intel--; duration = 20; }
            case "repair" -> { if (state.teams < 1) return; state.teams--; duration = 55; }
            default -> { return; }
        }
        state.slots--;
        state.active.add(new ActiveCommand(id, state.time + duration));
    }

    private void step(Model state) {
        state.time++;
        List<ActiveCommand> due = state.active.stream().filter(a -> a.finish <= state.time).toList();
        state.active.removeIf(a -> a.finish <= state.time);
        due.forEach(a -> complete(state, a));

        if (state.debtActive && state.telecomRuntime > 0) {
            state.telecomRuntime--;
            if (state.telecomRuntime == 0 && state.backupDepletedAt == null) state.backupDepletedAt = state.time;
        }

        Status beforeTelecom = telecomStatus(state.telecomCapacity);
        Status beforeTraffic = trafficStatus(state.trafficThroughput);
        Status beforeWater = genericStatus(state.waterPressure);
        Status beforeEmergency = emergencyStatus(state.emergencyResponse);
        Status beforeHospital = genericStatus(state.hospitalTreatment);

        updateMetrics(state);

        recordCrossing(state, beforeTelecom, telecomStatus(state.telecomCapacity));
        recordCrossing(state, beforeTraffic, trafficStatus(state.trafficThroughput));
        recordCrossing(state, beforeWater, genericStatus(state.waterPressure));
        recordCrossing(state, beforeEmergency, emergencyStatus(state.emergencyResponse));
        recordCrossing(state, beforeHospital, genericStatus(state.hospitalTreatment));

        if (deficit(state) == 0 && state.recoveryTime == null &&
                rank(telecomStatus(state.telecomCapacity)) <= 1 && rank(trafficStatus(state.trafficThroughput)) <= 1 &&
                rank(genericStatus(state.waterPressure)) <= 1 && rank(emergencyStatus(state.emergencyResponse)) <= 1 &&
                rank(genericStatus(state.hospitalTreatment)) <= 1) {
            state.recoveryTime = state.time;
        }
    }

    private void complete(Model state, ActiveCommand command) {
        state.slots = Math.min(2, state.slots + 1);
        state.completed.add(command.id);
        switch (command.id) {
            case "reroute" -> state.generation += 80;
            case "mobile" -> state.generation += 60;
            case "shed" -> { state.demand = Math.max(0, state.demand - 90); state.telecomRuntime = 156; state.debtActive = true; }
            case "prioritize" -> state.priorityTelecom = true;
            case "repair" -> state.generation += 30;
            default -> { }
        }
    }

    private void updateMetrics(Model s) {
        double pressure = gridRate(deficit(s));
        s.exposureTelecom += pressure;
        s.exposureTraffic += pressure * .52;
        s.exposureWater += pressure * .58;
        s.exposureHospital += pressure * .03;

        double telecomBaseLoss = stretchedLoss(s.exposureTelecom, 50, 146.4435385, .7943377753);
        double trafficLoss = stretchedLoss(s.exposureTraffic, 28, 215, .7943377753);
        double waterLoss = stretchedLoss(s.exposureWater, 32, 205, .7943377753);
        double debtPenalty = 0;
        if (s.backupDepletedAt != null) {
            int age = Math.max(0, s.time - s.backupDepletedAt);
            debtPenalty = 2 + Math.min(22, age * (22.0 / 21.0));
        }
        double priorityPenalty = s.priorityTelecom ? 8 : 0;
        s.telecomCapacity = Math.max(0, 100 - telecomBaseLoss - debtPenalty - priorityPenalty);
        s.trafficThroughput = Math.max(0, 88 - trafficLoss);
        s.trafficSignal = Math.max(0, 96 - trafficLoss * .75);
        s.waterPressure = Math.max(0, 91 - waterLoss);
        s.waterPumps = Math.max(0, 94 - waterLoss * .8);

        double telecomPressure = Math.max(0, 86 - s.telecomCapacity);
        double trafficPressure = Math.max(0, 82 - s.trafficThroughput);
        s.exposureEmergency += (telecomPressure / 100) * .8 + (trafficPressure / 100) * .55;
        double emergencyLoss = stretchedLoss(s.exposureEmergency, 45, 35, .9);
        s.emergencyResponse = Math.max(0, 84 - emergencyLoss);
        s.emergencyComms = Math.max(0, 92 - emergencyLoss * .8 + (s.priorityTelecom ? 12 : 0));

        double waterPressure = Math.max(0, 86 - s.waterPressure);
        double emergencyPressure = Math.max(0, 81 - s.emergencyResponse);
        s.exposureHospital += (waterPressure / 100) * .65 + (emergencyPressure / 100) * .75;
        double hospitalLoss = stretchedLoss(s.exposureHospital, 48, 85, .92);
        s.hospitalTreatment = Math.max(0, 90 - hospitalLoss);
        s.hospitalBackup = Math.max(0, 82 - hospitalLoss * .35);
    }

    private void recordCrossing(Model s, Status before, Status after) {
        if (rank(after) <= rank(before)) return;
        s.cascadeEvents++;
        if (after == Status.STRESSED && s.firstStressed == null) s.firstStressed = s.time;
        if (after == Status.DEGRADED && s.firstDegraded == null) s.firstDegraded = s.time;
    }

    private int deficit(Model s) { return Math.max(0, s.demand - s.generation); }
    private double gridRate(int deficit) { return deficit <= 0 ? 0 : Math.pow(Math.min(1.5, deficit / 120.0), 1.76); }
    private double stretchedLoss(double exposure, double maxLoss, double scale, double shape) {
        return exposure <= 0 ? 0 : maxLoss * (1 - Math.exp(-Math.pow(exposure / scale, shape)));
    }
    private Status telecomStatus(double v) { return genericStatus(v); }
    private Status trafficStatus(double v) { return v <= 40 ? Status.CRITICAL : v <= 65 ? Status.DEGRADED : v <= 80 ? Status.STRESSED : Status.NORMAL; }
    private Status emergencyStatus(double v) { return v <= 40 ? Status.CRITICAL : v <= 65 ? Status.DEGRADED : v <= 80 ? Status.STRESSED : Status.NORMAL; }
    private Status genericStatus(double v) { return v <= 40 ? Status.CRITICAL : v <= 65 ? Status.DEGRADED : v <= 85 ? Status.STRESSED : Status.NORMAL; }
    private int rank(Status s) { return switch (s) { case NORMAL -> 0; case STRESSED -> 1; case DEGRADED -> 2; case CRITICAL -> 3; }; }
}
