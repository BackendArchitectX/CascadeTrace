export type SystemName = 'Power' | 'Telecom' | 'Traffic' | 'Water' | 'Hospital' | 'Emergency Services'
export type ReportStatus = 'Confirmed' | 'Probable' | 'Unverified' | 'Unknown'
export type Selection =
  | { type: 'system'; value: SystemName }
  | { type: 'edge'; value: string }
  | { type: 'report'; value: string }

export type EventKind = 'INITIAL' | 'COMMAND' | 'COMPLETE' | 'CASCADE' | 'RECOVERY' | 'DEBT ACTIVE' | 'FALSE REPORT' | 'OUTCOME'

export type IncidentEvent = {
  time: number
  text: string
  kind: EventKind
  sourceSystem?: SystemName
  targetSystem?: SystemName
  metric?: string
  oldValue?: number
  newValue?: number
  causeId?: string
}

export type Report = {
  id: string
  title: string
  status: ReportStatus
  claim: string
  trueReport: boolean
}

export type ActiveCommand = { id: string; finish: number; reportId?: string }

export type SystemValues = {
  Power: { generation: number; demand: number; reserve: number }
  Telecom: { load: number; capacity: number; runtime: number }
  Traffic: { signal: number; throughput: number; delay: number }
  Water: { pumps: number; pressure: number }
  Hospital: { arrivals: number; treatment: number; queue: number; backup: number }
  'Emergency Services': { response: number; comms: number; delay: number }
}

export type Resources = { reserve: number; mobile: number; teams: number; slots: number; intel: number }

export type State = {
  time: number
  running: boolean
  ended: boolean
  values: SystemValues
  resources: Resources
  reports: Report[]
  active: ActiveCommand[]
  log: IncidentEvent[]
  selected: Selection
  completed: string[]
  debtActive: boolean
  reducedMotion: boolean
  activeEdges: string[]
  exposure: Record<'Telecom' | 'Traffic' | 'Water' | 'Hospital' | 'Emergency Services', number>
  recoveryTime?: number
  backupDepletedAt?: number
  priorityTelecom: boolean
}

export const systems: SystemName[] = ['Power', 'Telecom', 'Traffic', 'Water', 'Hospital', 'Emergency Services']

export const edges = [
  ['Power', 'Telecom', 'capacity'],
  ['Power', 'Traffic', 'signal availability'],
  ['Power', 'Water', 'pump capacity'],
  ['Power', 'Hospital', 'backup power'],
  ['Telecom', 'Emergency Services', 'communications quality'],
  ['Traffic', 'Emergency Services', 'response delay'],
  ['Water', 'Hospital', 'treatment capacity'],
  ['Emergency Services', 'Hospital', 'arrivals'],
] as const satisfies ReadonlyArray<readonly [SystemName, SystemName, string]>

export const commandDefs = [
  { id: 'reroute', name: 'Reroute Grid Capacity', cost: '12 Grid Reserve', duration: 35, requirements: 'Grid Reserve >= 12; Command Slot', effect: '+80 MW available generation', debt: '' },
  { id: 'shed', name: 'Shed Non-Critical Load', cost: '1 Command Slot', duration: 25, requirements: 'Power deficit > 0; Command Slot', effect: '-90 MW demand on completion', debt: 'Selected telecom sites move to battery power; runtime counts down.' },
  { id: 'mobile', name: 'Deploy a Mobile Generator', cost: '1 Mobile Power; Command Slot', duration: 40, requirements: 'Mobile Power >= 1; Command Slot', effect: '+60 MW available generation', debt: '' },
  { id: 'prioritize', name: 'Prioritize Emergency Telecom Traffic', cost: '1 Command Slot', duration: 30, requirements: 'Command Slot', effect: '+12% Emergency Services communications', debt: 'Non-emergency Telecom capacity decreases by 8%.' },
  { id: 'verify', name: 'Verify an Uncertain Field Report', cost: '1 Intel Capacity; Command Slot', duration: 20, requirements: 'Unverified report selected; Intel Capacity; Command Slot', effect: 'Report resolves to Confirmed or false', debt: '' },
  { id: 'repair', name: 'Dispatch a Repair Team', cost: '1 Field Team; Command Slot', duration: 55, requirements: 'Confirmed repair target; Field Team; Command Slot', effect: 'Improves selected confirmed target', debt: '' },
] as const

export type CommandId = typeof commandDefs[number]['id']

const initialResources: Resources = { reserve: 72, mobile: 2, teams: 2, slots: 2, intel: 2 }
const initialValues: SystemValues = {
  Power: { generation: 920, demand: 1040, reserve: 72 },
  Telecom: { load: 78, capacity: 100, runtime: 0 },
  Traffic: { signal: 96, throughput: 88, delay: 7 },
  Water: { pumps: 94, pressure: 91 },
  Hospital: { arrivals: 34, treatment: 90, queue: 12, backup: 82 },
  'Emergency Services': { response: 84, comms: 92, delay: 9 },
}

const initialReports: Report[] = [
  { id: 'R-14', title: 'North relay cabinet', status: 'Unverified', claim: 'Relay cabinet failure reported by field unit.', trueReport: true },
  { id: 'R-22', title: 'Canal pump telemetry', status: 'Probable', claim: 'Pump telemetry is intermittently unavailable.', trueReport: false },
  { id: 'R-31', title: 'S14 protection trip', status: 'Confirmed', claim: 'Substation S14 lost 180 MW during peak demand.', trueReport: true },
  { id: 'R-40', title: 'Unidentified radio burst', status: 'Unknown', claim: '', trueReport: false },
]

const cloneValues = (values: SystemValues): SystemValues => structuredClone(values)
const cloneReports = (reports: Report[]): Report[] => structuredClone(reports)

export const freshState = (): State => ({
  time: 0,
  running: false,
  ended: false,
  values: cloneValues(initialValues),
  resources: { ...initialResources },
  reports: cloneReports(initialReports),
  active: [],
  log: [{ time: 0, kind: 'INITIAL', text: 'S14 loss confirmed: 180 MW removed during peak demand.', sourceSystem: 'Power', targetSystem: 'Power', metric: 'generation', oldValue: 1100, newValue: 920, causeId: 's14-loss' }],
  selected: { type: 'system', value: 'Power' },
  completed: [],
  debtActive: false,
  reducedMotion: false,
  activeEdges: [],
  exposure: { Telecom: 0, Traffic: 0, Water: 0, Hospital: 0, 'Emergency Services': 0 },
  priorityTelecom: false,
})

export const deficit = (state: State) => Math.max(0, state.values.Power.demand - state.values.Power.generation)

const statusFor = (system: SystemName, state: State) => {
  if (system === 'Power') {
    const ratio = deficit(state) / Math.max(1, state.values.Power.demand)
    return ratio === 0 ? 'NORMAL' : ratio <= .05 ? 'STRESSED' : ratio <= .1 ? 'DEGRADED' : 'CRITICAL'
  }
  const value = system === 'Telecom'
    ? state.values.Telecom.capacity
    : system === 'Traffic'
      ? state.values.Traffic.throughput
      : system === 'Water'
        ? state.values.Water.pressure
        : system === 'Hospital'
          ? state.values.Hospital.treatment
          : state.values['Emergency Services'].response
  const stressedThreshold = system === 'Traffic' || system === 'Emergency Services' ? 80 : 85
  return value <= 40 ? 'CRITICAL' : value <= 65 ? 'DEGRADED' : value <= stressedThreshold ? 'STRESSED' : 'NORMAL'
}

const rank = (status: string) => status === 'CRITICAL' ? 3 : status === 'DEGRADED' ? 2 : status === 'STRESSED' ? 1 : 0

const gridRate = (powerDeficit: number) => {
  if (powerDeficit <= 0) return 0
  return Math.pow(Math.min(1.5, powerDeficit / 120), 1.76)
}

const stretchedLoss = (exposure: number, maxLoss: number, scale: number, shape = .7943377753) => {
  if (exposure <= 0) return 0
  return maxLoss * (1 - Math.exp(-Math.pow(exposure / scale, shape)))
}

function updateExposureAndMetrics(next: State) {
  const pressure = gridRate(deficit(next))
  next.exposure.Telecom += pressure
  next.exposure.Traffic += pressure * .52
  next.exposure.Water += pressure * .58
  next.exposure.Hospital += pressure * .03

  const telecomBaseLoss = stretchedLoss(next.exposure.Telecom, 50, 146.4435385)
  const trafficLoss = stretchedLoss(next.exposure.Traffic, 28, 215)
  const waterLoss = stretchedLoss(next.exposure.Water, 32, 205)

  let debtPenalty = 0
  if (next.backupDepletedAt !== undefined) {
    const age = Math.max(0, next.time - next.backupDepletedAt)
    debtPenalty = 2 + Math.min(22, age * (22 / 21))
  }
  const priorityPenalty = next.priorityTelecom ? 8 : 0
  next.values.Telecom.capacity = Math.max(0, 100 - telecomBaseLoss - debtPenalty - priorityPenalty)
  next.values.Traffic.throughput = Math.max(0, 88 - trafficLoss)
  next.values.Traffic.signal = Math.max(0, 96 - trafficLoss * .75)
  next.values.Traffic.delay = 7 + trafficLoss * .16
  next.values.Water.pressure = Math.max(0, 91 - waterLoss)
  next.values.Water.pumps = Math.max(0, 94 - waterLoss * .8)

  const telecomPressure = Math.max(0, 86 - next.values.Telecom.capacity)
  const trafficPressure = Math.max(0, 82 - next.values.Traffic.throughput)
  next.exposure['Emergency Services'] += (telecomPressure / 100) * .8 + (trafficPressure / 100) * .55
  const emergencyLoss = stretchedLoss(next.exposure['Emergency Services'], 45, 35, .9)
  next.values['Emergency Services'].response = Math.max(0, 84 - emergencyLoss)
  next.values['Emergency Services'].comms = Math.max(0, 92 - emergencyLoss * .8 + (next.priorityTelecom ? 12 : 0))
  next.values['Emergency Services'].delay = 9 + emergencyLoss * .18

  const waterPressure = Math.max(0, 86 - next.values.Water.pressure)
  const emergencyPressure = Math.max(0, 81 - next.values['Emergency Services'].response)
  next.exposure.Hospital += (waterPressure / 100) * .65 + (emergencyPressure / 100) * .75
  const hospitalLoss = stretchedLoss(next.exposure.Hospital, 48, 85, .92)
  next.values.Hospital.treatment = Math.max(0, 90 - hospitalLoss)
  next.values.Hospital.backup = Math.max(0, 82 - hospitalLoss * .35)
  next.values.Hospital.arrivals = 34 + emergencyLoss * .45
  next.values.Hospital.queue = 12 + hospitalLoss * .5
}

function eventCause(system: SystemName, state: State) {
  if (system === 'Telecom' && state.backupDepletedAt !== undefined && state.time >= state.backupDepletedAt) {
    return { sourceSystem: 'Telecom' as SystemName, causeId: 'telecom-backup-depletion', metric: 'capacity' }
  }
  if (system === 'Emergency Services') return { sourceSystem: 'Telecom' as SystemName, causeId: 'telecom-traffic', metric: 'response' }
  if (system === 'Hospital') return { sourceSystem: 'Water' as SystemName, causeId: 'water-emergency', metric: 'treatment' }
  return { sourceSystem: 'Power' as SystemName, causeId: 'power-deficit', metric: system === 'Telecom' ? 'capacity' : system === 'Traffic' ? 'throughput' : system === 'Water' ? 'pressure' : 'backup' }
}

function metricValue(system: SystemName, state: State) {
  return system === 'Telecom' ? state.values.Telecom.capacity
    : system === 'Traffic' ? state.values.Traffic.throughput
      : system === 'Water' ? state.values.Water.pressure
        : system === 'Hospital' ? state.values.Hospital.treatment
          : system === 'Emergency Services' ? state.values['Emergency Services'].response
            : deficit(state)
}

function appendStatusEvents(previous: State, next: State) {
  for (const system of systems.filter((name) => name !== 'Power')) {
    const before = statusFor(system, previous)
    const after = statusFor(system, next)
    if (before === after) continue
    const cause = eventCause(system, next)
    const eventBase = {
      time: next.time,
      sourceSystem: cause.sourceSystem,
      targetSystem: system,
      metric: cause.metric,
      oldValue: metricValue(system, previous),
      newValue: metricValue(system, next),
      causeId: cause.causeId,
    }
    if (rank(after) > rank(before)) {
      next.log.push({ ...eventBase, kind: 'CASCADE', text: `${system} ${cause.metric}: ${after}` })
    } else {
      next.log.push({ ...eventBase, kind: 'RECOVERY', text: `${system} ${cause.metric} recovered to ${after}` })
    }
  }
}

function updateActiveEdges(state: State) {
  const active = new Set<string>()
  if (deficit(state) > 0) {
    active.add('Power->Telecom')
    active.add('Power->Traffic')
    active.add('Power->Water')
    active.add('Power->Hospital')
  }
  if (statusFor('Telecom', state) !== 'NORMAL') active.add('Telecom->Emergency Services')
  if (statusFor('Traffic', state) !== 'NORMAL') active.add('Traffic->Emergency Services')
  if (statusFor('Water', state) !== 'NORMAL') active.add('Water->Hospital')
  if (statusFor('Emergency Services', state) !== 'NORMAL') active.add('Emergency Services->Hospital')
  state.activeEdges = [...active]
}

function completeCommand(next: State, command: ActiveCommand) {
  const def = commandDefs.find((item) => item.id === command.id)
  if (!def) return
  next.resources.slots = Math.min(2, next.resources.slots + 1)
  next.completed.push(command.id)
  if (command.id === 'reroute') next.values.Power.generation += 80
  if (command.id === 'mobile') next.values.Power.generation += 60
  if (command.id === 'shed') {
    next.values.Power.demand = Math.max(0, next.values.Power.demand - 90)
    next.values.Telecom.runtime = 156
    next.debtActive = true
    next.log.push({ time: next.time, kind: 'DEBT ACTIVE', text: 'Load shedding moved selected telecom sites to battery backup.', sourceSystem: 'Power', targetSystem: 'Telecom', metric: 'runtime', newValue: 156, causeId: 'load-shed' })
  }
  if (command.id === 'prioritize') next.priorityTelecom = true
  if (command.id === 'verify' && command.reportId) {
    const report = next.reports.find((item) => item.id === command.reportId)
    if (report) {
      if (report.trueReport) report.status = 'Confirmed'
      else {
        report.status = 'Unknown'
        next.log.push({ time: next.time, kind: 'FALSE REPORT', text: `${report.id} did not verify against seed-resolved evidence.`, causeId: 'field-intel' })
      }
    }
  }
  if (command.id === 'repair' && command.reportId) {
    if (command.reportId === 'R-31') next.values.Power.generation += 30
    if (command.reportId === 'R-14') next.exposure.Telecom = Math.max(0, next.exposure.Telecom - 22)
  }
  next.log.push({ time: next.time, kind: 'COMPLETE', text: `${def.name} completed.` })
}

export function stepSimulation(current: State): State {
  if (!current.running || current.ended) return current
  if (current.time >= 420) return { ...current, running: false, ended: true, active: [] }

  const previous = structuredClone(current) as State
  const next: State = {
    ...current,
    time: current.time + 1,
    values: cloneValues(current.values),
    resources: { ...current.resources },
    reports: cloneReports(current.reports),
    active: current.active.map((item) => ({ ...item })),
    log: current.log.map((event) => ({ ...event })),
    completed: [...current.completed],
    activeEdges: [...current.activeEdges],
    exposure: { ...current.exposure },
  }

  const due = next.active.filter((item) => item.finish <= next.time)
  next.active = next.active.filter((item) => item.finish > next.time)
  due.forEach((command) => completeCommand(next, command))

  if (next.debtActive && next.values.Telecom.runtime > 0) {
    next.values.Telecom.runtime = Math.max(0, next.values.Telecom.runtime - 1)
    if (next.values.Telecom.runtime === 0 && next.backupDepletedAt === undefined) {
      next.backupDepletedAt = next.time
      next.log.push({ time: next.time, kind: 'DEBT ACTIVE', text: 'Telecom backup runtime depleted.', sourceSystem: 'Telecom', targetSystem: 'Telecom', metric: 'runtime', oldValue: 1, newValue: 0, causeId: 'telecom-backup-depletion' })
    }
  }

  updateExposureAndMetrics(next)
  appendStatusEvents(previous, next)
  updateActiveEdges(next)

  if (deficit(next) === 0 && next.recoveryTime === undefined) {
    const allStable = systems.filter((name) => name !== 'Power').every((name) => rank(statusFor(name, next)) <= 1)
    if (allStable) {
      next.recoveryTime = next.time
      next.log.push({ time: next.time, kind: 'RECOVERY', text: 'City power balance restored and critical services stabilized.', sourceSystem: 'Power', targetSystem: 'Power', metric: 'deficit', oldValue: deficit(previous), newValue: 0, causeId: 'power-balance' })
    }
  }

  if (next.time >= 420) {
    next.running = false
    next.ended = true
    next.active = []
    next.log.push({ time: 420, kind: 'OUTCOME', text: 'Scenario ended at 07:00.' })
  }
  return next
}

export function commandBlock(id: string, state: State, report?: Report) {
  const def = commandDefs.find((item) => item.id === id)
  if (!def) return 'BLOCKED: unknown command.'
  if (!state.running || state.ended) return 'BLOCKED: scenario is not running.'
  if (state.resources.slots < 1 || state.active.length >= 2) return 'BLOCKED: Command Slot required.'
  if (state.active.some((item) => item.id === id)) return 'BLOCKED: command already in progress.'
  if (id !== 'verify' && id !== 'repair' && state.completed.includes(id)) return 'BLOCKED: command already completed.'
  if (id === 'reroute' && state.resources.reserve < 12) return 'BLOCKED: Grid Reserve >= 12 required.'
  if (id === 'mobile' && state.resources.mobile < 1) return 'BLOCKED: Mobile Power required.'
  if (id === 'verify' && (!report || report.status !== 'Unverified')) return 'BLOCKED: select an Unverified report.'
  if (id === 'verify' && state.resources.intel < 1) return 'BLOCKED: Intel Capacity required.'
  if (id === 'repair' && (!report || report.status !== 'Confirmed')) return 'BLOCKED: select a Confirmed repair target.'
  if (id === 'repair' && state.resources.teams < 1) return 'BLOCKED: Field Team required.'
  if (id === 'shed' && deficit(state) <= 0) return 'BLOCKED: Power deficit must be positive.'
  return ''
}

export function commitCommand(state: State, id: string, report?: Report): State {
  const blocked = commandBlock(id, state, report)
  if (blocked) return state
  const def = commandDefs.find((item) => item.id === id)
  if (!def) return state
  const next: State = {
    ...state,
    resources: { ...state.resources },
    active: state.active.map((item) => ({ ...item })),
    log: state.log.map((event) => ({ ...event })),
  }
  next.resources.slots -= 1
  if (id === 'reroute') next.resources.reserve -= 12
  if (id === 'mobile') next.resources.mobile -= 1
  if (id === 'verify') next.resources.intel -= 1
  if (id === 'repair') next.resources.teams -= 1
  next.active.push({ id, finish: state.time + def.duration, reportId: id === 'verify' || id === 'repair' ? report?.id : undefined })
  next.log.push({ time: state.time, kind: 'COMMAND', text: `${def.name} accepted. Completion at ${String(Math.floor((state.time + def.duration) / 60)).padStart(2, '0')}:${String((state.time + def.duration) % 60).padStart(2, '0')}.` })
  return next
}
