import type { SystemName } from './engine'

export const INCIDENT_LOSS_MW = 180
export const SCENARIO_DURATION_SECONDS = 420
export const DISPLAY_DURATION_SECONDS = 60
export const SIMULATION_SPEED = 7
export const DECISION_DEBT_LEVELS = { elevated: 2 } as const

export const SYSTEM_NAMES = {
  power: 'Power',
  telecom: 'Telecom',
  traffic: 'Traffic',
  water: 'Water',
  hospital: 'Hospital',
  emergencyServices: 'Emergency Services',
} as const satisfies Record<string, SystemName>

export const DISPLAY_NAMES: Record<SystemName, string> = {
  Power: 'Power',
  Telecom: 'Telecom',
  Traffic: 'Traffic',
  Water: 'Water',
  Hospital: 'Hospital',
  'Emergency Services': 'Emergency Services',
}
