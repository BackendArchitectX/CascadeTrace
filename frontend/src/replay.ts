import { commandBlock, commitCommand, freshState, stepSimulation, type State } from './engine'

export type RecordedCommand = {
  second: number
  commandId: string
  reportId?: string
  insertionOrder: number
}

export type ReplayResult = {
  state: State
  acceptedCommands: RecordedCommand[]
  rejectedCommands: { command: RecordedCommand; reason: string }[]
}

export function replayTo(commands: RecordedCommand[], untilSecond: number): ReplayResult {
  let state: State = { ...freshState(), running: true }
  const acceptedCommands: RecordedCommand[] = []
  const rejectedCommands: { command: RecordedCommand; reason: string }[] = []
  const ordered = [...commands].sort((a, b) => a.second - b.second || a.insertionOrder - b.insertionOrder)
  let cursor = 0
  const target = Math.max(0, Math.min(420, Math.floor(untilSecond)))

  while (state.time < target) {
    while (cursor < ordered.length && ordered[cursor].second === state.time) {
      const command = ordered[cursor]
      const report = command.reportId ? state.reports.find((item) => item.id === command.reportId) : undefined
      const reason = commandBlock(command.commandId, state, report)
      if (reason) rejectedCommands.push({ command, reason })
      else {
        state = commitCommand(state, command.commandId, report)
        acceptedCommands.push(command)
      }
      cursor += 1
    }
    state = stepSimulation(state)
    if (state.ended) break
  }

  return { state, acceptedCommands, rejectedCommands }
}

export function replay(commands: RecordedCommand[]): ReplayResult {
  return replayTo(commands, 420)
}
