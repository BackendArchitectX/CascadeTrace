import type { RecordedCommand } from './replay'

export type BackendHealth = {
  status: string
  service: string
  version: string
  deterministic: boolean
}

export type ReplaySummary = {
  firstStressed: number | null
  firstDegraded: number | null
  recoveryTime: number | null
  finalDeficit: number
}

export type ReplayEvaluation = {
  firstStressed: number | null
  firstDegraded: number | null
  recoveryTime: number | null
  finalDeficit: number
  cascadeEvents: number
  decisionDebt: boolean
  verified: boolean
  fingerprint: string
}

export type SimulationRunSummary = {
  id: string
  scenarioId: string
  recordedAt: string
  verified: boolean
  finalDeficit: number
  recoveryTime: number | null
  cascadeEvents: number
  decisionDebt: boolean
  commandCount: number
  fingerprint: string
}

export type SimulationRunPage = {
  items: SimulationRunSummary[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export type RunCommand = {
  second: number
  commandId: string
  reportId: string | null
  insertionOrder: number
}

export type SimulationRunDetail = {
  id: string
  scenarioId: string
  recordedAt: string
  commandCount: number
  commands: RunCommand[]
  clientSummary: ReplaySummary
  serverEvaluation: ReplayEvaluation
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8080/api/v1'

async function request<T>(path: string, init?: RequestInit, timeoutMs = 1800): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`API ${response.status}`)
    return await response.json() as T
  } finally {
    window.clearTimeout(timeout)
  }
}

export const getBackendHealth = () => request<BackendHealth>('/health', undefined, 1200)

export const evaluateReplay = (commands: RecordedCommand[], clientSummary: ReplaySummary) => request<ReplayEvaluation>('/replay', {
  method: 'POST',
  body: JSON.stringify({ commands, clientSummary }),
}, 4000)

export const getRuns = (page = 0, size = 20) => request<SimulationRunPage>(`/runs?page=${page}&size=${size}`, undefined, 4000)

export const getRun = (id: string) => request<SimulationRunDetail>(`/runs/${encodeURIComponent(id)}`, undefined, 4000)

export const reverifyRun = (id: string) => request<SimulationRunDetail>(`/runs/${encodeURIComponent(id)}/verify`, {
  method: 'POST',
}, 5000)
