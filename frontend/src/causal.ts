import { deficit, type IncidentEvent, type State, type SystemName } from './engine'
import { replayTo, type RecordedCommand, type ReplayResult } from './replay'

export type EvidenceNode = {
  id: string
  system?: SystemName
  metric?: string
  causeId?: string
  time?: number
  newValue?: number
  evidence: string
}

export type CausalAnalysis = {
  selectedEvent: IncidentEvent
  confidence: 'SUPPORTED' | 'PARTIAL' | 'INCOMPLETE'
  immediateCause?: EvidenceNode
  chain: EvidenceNode[]
  contributors: EvidenceNode[]
  decisionDebt: EvidenceNode[]
  completeness: string
}

const metricSnapshot = (state: State, system: SystemName, metric: string) => {
  if (system === 'Power' && metric === 'deficit') return deficit(state)
  const values = state.values[system] as Record<string, number>
  return values?.[metric]
}

const node = (id: string, system: SystemName, metric: string, causeId: string, state: State, time: number, evidence = 'snapshot'): EvidenceNode => ({
  id,
  system,
  metric,
  causeId,
  time,
  newValue: metricSnapshot(state, system, metric),
  evidence,
})

export function analyzeCausalEvent(event: IncidentEvent, replayResult: ReplayResult, _commands: RecordedCommand[]): CausalAnalysis {
  const state = event.time < replayResult.state.time ? replayTo(_commands, event.time).state : replayResult.state
  const causeId = event.causeId ?? 'unknown'

  if (causeId === 'telecom-traffic') {
    const contributors = [
      node('telecom-capacity', 'Telecom', 'capacity', causeId, state, event.time, 'recorded contributor'),
      node('traffic-throughput', 'Traffic', 'throughput', causeId, state, event.time, 'recorded contributor'),
    ]
    return {
      selectedEvent: event,
      confidence: 'PARTIAL',
      chain: [],
      contributors,
      decisionDebt: [],
      completeness: 'Recorded provenance identifies parallel Telecom and Traffic contributors; upstream timing detail may be incomplete.',
    }
  }

  if (causeId === 'water-emergency') {
    const contributors = [
      node('water-pressure', 'Water', 'pressure', causeId, state, event.time, 'recorded contributor'),
      node('emergency-response', 'Emergency Services', 'response', causeId, state, event.time, 'recorded contributor'),
    ]
    return {
      selectedEvent: event,
      confidence: 'PARTIAL',
      chain: [],
      contributors,
      decisionDebt: [],
      completeness: 'Hospital pressure is supported by Water and Emergency Services evidence recorded in the deterministic replay.',
    }
  }

  if (causeId === 'telecom-backup-depletion' || causeId === 'load-shed') {
    const debt = node('telecom-backup-depletion', 'Telecom', 'runtime', 'telecom-backup-depletion', state, event.time, 'decision-debt provenance')
    return {
      selectedEvent: event,
      confidence: 'SUPPORTED',
      immediateCause: debt,
      chain: [debt],
      contributors: [],
      decisionDebt: [debt],
      completeness: 'The delayed Telecom consequence is directly traceable to the load-shed battery-depletion path.',
    }
  }

  if (causeId === 'power-deficit') {
    const power = node('power-deficit', 'Power', 'deficit', causeId, state, event.time, 'authoritative replay snapshot')
    return {
      selectedEvent: event,
      confidence: 'SUPPORTED',
      immediateCause: power,
      chain: [power],
      contributors: [power],
      decisionDebt: [],
      completeness: 'The selected threshold crossing is directly supported by the recorded Power deficit and dependency provenance.',
    }
  }

  const immediate = event.sourceSystem && event.metric
    ? node('direct-source', event.sourceSystem, event.metric, causeId, state, event.time)
    : undefined

  return {
    selectedEvent: event,
    confidence: immediate ? 'PARTIAL' : 'INCOMPLETE',
    immediateCause: immediate,
    chain: immediate ? [immediate] : [],
    contributors: immediate ? [immediate] : [],
    decisionDebt: [],
    completeness: immediate ? 'A direct recorded contributor exists, but the complete upstream chain is not available.' : 'INCOMPLETE EVIDENCE / No supported causal chain recorded.',
  }
}
