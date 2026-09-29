import { deficit, systems, type State, type SystemName } from './engine'
import { replay, type RecordedCommand, type ReplayResult } from './replay'

export type BranchOperation =
  | { kind: 'remove'; commandId: string }
  | { kind: 'replace'; commandId: string; replacementCommandId: string }
  | { kind: 'add'; commandId: string; insertionOrder: number }

export type ForkComparison = {
  firstStressed: number | null
  firstDegraded: number | null
  recoveryTime: number | null
  finalDeficit: number
  statusMetricDeltas: Record<string, Record<string, number>>
  resourceDifferences: Record<string, number>
  eventsPrevented: string[]
  eventsIntroduced: string[]
  changedCausalChains: string[]
}

export type ForkResult = {
  original: ReplayResult
  branch: ReplayResult & { accepted: boolean; reason?: string }
  comparison: ForkComparison
}

const firstEvent = (state: State, text: string) => state.log.find((event) => event.kind === 'CASCADE' && event.text.includes(text))?.time ?? null

const metricFor = (state: State, system: SystemName): Record<string, number> => {
  if (system === 'Power') return { deficit: deficit(state) }
  if (system === 'Telecom') return { capacity: state.values.Telecom.capacity }
  if (system === 'Traffic') return { throughput: state.values.Traffic.throughput }
  if (system === 'Water') return { pressure: state.values.Water.pressure }
  if (system === 'Hospital') return { treatment: state.values.Hospital.treatment }
  return { response: state.values['Emergency Services'].response }
}

const eventSignature = (text: string) => text.replace(/\s+/g, ' ').trim()

export function forkline(input: { originalCommands: RecordedCommand[]; forkSecond: number; operation: BranchOperation }): ForkResult {
  const original = replay(input.originalCommands)
  const targetIndex = input.originalCommands.findIndex((command) => command.second === input.forkSecond && command.commandId === ('commandId' in input.operation ? input.operation.commandId : ''))
  let branchCommands = [...input.originalCommands]

  if (input.operation.kind === 'remove') {
    if (targetIndex >= 0) branchCommands.splice(targetIndex, 1)
  } else if (input.operation.kind === 'replace') {
    if (targetIndex >= 0) branchCommands[targetIndex] = { ...branchCommands[targetIndex], commandId: input.operation.replacementCommandId }
  } else {
    branchCommands.push({ second: input.forkSecond, commandId: input.operation.commandId, insertionOrder: input.operation.insertionOrder })
  }

  const branchReplay = replay(branchCommands)
  const accepted = branchReplay.rejectedCommands.length === 0
  const branch = { ...branchReplay, accepted, reason: accepted ? undefined : branchReplay.rejectedCommands[0]?.reason }

  const statusMetricDeltas: Record<string, Record<string, number>> = {}
  for (const system of systems) {
    const originalMetrics = metricFor(original.state, system)
    const branchMetrics = metricFor(branch.state, system)
    statusMetricDeltas[system] = Object.fromEntries(Object.keys(originalMetrics).map((key) => [key, branchMetrics[key] - originalMetrics[key]]))
  }

  const resourceDifferences = Object.fromEntries(Object.keys(original.state.resources).map((key) => [key, branch.state.resources[key as keyof typeof branch.state.resources] - original.state.resources[key as keyof typeof original.state.resources]]))
  const originalEvents = new Set(original.state.log.filter((event) => event.kind === 'CASCADE' || event.kind === 'RECOVERY' || event.kind === 'DEBT ACTIVE').map((event) => eventSignature(event.text)))
  const branchEvents = new Set(branch.state.log.filter((event) => event.kind === 'CASCADE' || event.kind === 'RECOVERY' || event.kind === 'DEBT ACTIVE').map((event) => eventSignature(event.text)))
  const eventsPrevented = [...originalEvents].filter((event) => !branchEvents.has(event))
  const eventsIntroduced = [...branchEvents].filter((event) => !originalEvents.has(event))
  const changedCausalChains = eventsPrevented.length || eventsIntroduced.length
    ? [`${eventsPrevented.length} recorded event(s) prevented`, `${eventsIntroduced.length} recorded event(s) introduced`]
    : []

  return {
    original,
    branch,
    comparison: {
      firstStressed: firstEvent(branch.state, 'STRESSED'),
      firstDegraded: firstEvent(branch.state, 'DEGRADED'),
      recoveryTime: branch.state.recoveryTime ?? null,
      finalDeficit: deficit(branch.state),
      statusMetricDeltas,
      resourceDifferences,
      eventsPrevented,
      eventsIntroduced,
      changedCausalChains,
    },
  }
}
