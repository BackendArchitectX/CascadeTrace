import { StrictMode, useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type MouseEvent, type UIEvent } from 'react'



import { createRoot } from 'react-dom/client'



import './styles.css'



import { commandBlock, commandDefs, commitCommand, deficit, edges, freshState, systems, stepSimulation, type Selection, type State, type SystemName } from './engine'



import { forkline, type BranchOperation, type ForkResult } from './forkline'



import { replay, type RecordedCommand } from './replay'



import { analyzeCausalEvent, type CausalAnalysis } from './causal'



import { DECISION_DEBT_LEVELS, DISPLAY_DURATION_SECONDS, DISPLAY_NAMES, INCIDENT_LOSS_MW, SIMULATION_SPEED, SCENARIO_DURATION_SECONDS, SYSTEM_NAMES } from './ui-config'
import { evaluateReplay, getBackendHealth, type ReplayEvaluation } from './api'



const seed = `CITY01-60S-${INCIDENT_LOSS_MW}`



const displayName = (system: SystemName) => DISPLAY_NAMES[system]



const slugify = (value: string) => value.trim().toLowerCase().split(/\s+/).join('-')



const stamp = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

const displayStamp = (simulationSeconds: number) => stamp(Math.min(DISPLAY_DURATION_SECONDS, Math.floor(simulationSeconds / SIMULATION_SPEED)))

const visibleEventText = (text: string) => text.replace('07:00', '01:00')

const elapsedDisplaySeconds = (simulationSeconds: number) => Math.min(DISPLAY_DURATION_SECONDS, Math.floor(simulationSeconds / SIMULATION_SPEED))

const remainingDisplaySeconds = (simulationSeconds: number) => Math.max(0, DISPLAY_DURATION_SECONDS - elapsedDisplaySeconds(simulationSeconds))



const number = (value: number, digits = 1) => Number.isInteger(value) ? String(value) : value.toFixed(digits)



const displayValue = (key: string, value: number) => key === 'runtime' ? displayStamp(Math.max(0, Math.round(value))) : key === 'generation' || key === 'demand' || key === 'reserve' ? String(Math.round(value)) : number(value)



type Status = 'NORMAL' | 'STRESSED' | 'DEGRADED' | 'CRITICAL'



function systemStatus(state: State, system: SystemName): Status {



  if (system === 'Power') { const ratio = deficit(state) / Math.max(1, state.values.Power.demand); return ratio === 0 ? 'NORMAL' : ratio <= .05 ? 'STRESSED' : ratio <= .1 ? 'DEGRADED' : 'CRITICAL' }



  const value = system === 'Telecom' ? state.values.Telecom.capacity : system === 'Traffic' ? state.values.Traffic.throughput : system === 'Water' ? state.values.Water.pressure : system === 'Hospital' ? state.values.Hospital.treatment : system === SYSTEM_NAMES.emergencyServices ? state.values[SYSTEM_NAMES.emergencyServices].response : state.values.Power.generation



  return value <= 40 ? 'CRITICAL' : value <= 65 ? 'DEGRADED' : value <= (system === 'Traffic' || system === SYSTEM_NAMES.emergencyServices ? 80 : 85) ? 'STRESSED' : 'NORMAL'



}



function statusClass(status: Status) { return `status-${status.toLowerCase()}` }



function causeFor(state: State, system: SystemName) { return [...state.log].reverse().find((event) => event.targetSystem === system && (event.kind === 'CASCADE' || event.kind === 'DEBT ACTIVE')) }



type DecisionDebtLevel = 'CLEAR' | 'LOW' | 'ELEVATED' | 'HIGH'

function decisionDebt(state: State): DecisionDebtLevel {

  const debtEvents = state.log.filter((event) => event.kind === 'DEBT ACTIVE')

  if (!state.debtActive && debtEvents.length === 0) return 'CLEAR'

  if (state.debtActive && debtEvents.some((event) => event.causeId === 'telecom-backup-depletion')) return 'HIGH'

  return debtEvents.length >= DECISION_DEBT_LEVELS.elevated ? 'ELEVATED' : 'LOW'

}

function latestEvent(state: State['log']) { return state[state.length - 1] }







function App() {



  const [state, setState] = useState(freshState)



  const [pending, setPending] = useState<string | null>(null)



  const [notice, setNotice] = useState('')



  const [recordedCommands, setRecordedCommands] = useState<RecordedCommand[]>([])



  const [forkDecision, setForkDecision] = useState<RecordedCommand | null>(null)



  const [forkResult, setForkResult] = useState<ForkResult | null>(null)



  const [forkMode, setForkMode] = useState<'remove' | 'replace' | 'add'>('replace')



  const [forkAlternate, setForkAlternate] = useState('mobile')



  const [reviewTimeline, setReviewTimeline] = useState(false)

  const [timelineExpanded, setTimelineExpanded] = useState(false)

  const [introVisible, setIntroVisible] = useState(true)



  const [causalAnalysis, setCausalAnalysis] = useState<CausalAnalysis | null>(null)
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [serverEvaluation, setServerEvaluation] = useState<ReplayEvaluation | null>(null)







  useEffect(() => {
    let active = true
    getBackendHealth()
      .then((health) => { if (active) setBackendStatus(health.status === 'UP' ? 'online' : 'offline') })
      .catch(() => { if (active) setBackendStatus('offline') })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!state.ended) return
    const cascades = state.log.filter((event) => event.kind === 'CASCADE')
    const clientSummary = {
      firstStressed: cascades.find((event) => event.text.includes('STRESSED'))?.time ?? null,
      firstDegraded: cascades.find((event) => event.text.includes('DEGRADED'))?.time ?? null,
      recoveryTime: state.recoveryTime ?? null,
      finalDeficit: deficit(state),
    }
    evaluateReplay(recordedCommands, clientSummary)
      .then(setServerEvaluation)
      .catch(() => setServerEvaluation(null))
  }, [state.ended, recordedCommands])

  useEffect(() => {

    if (!state.running) return



    const timer = window.setInterval(() => setState((current) => stepSimulation(current)), 1000 / SIMULATION_SPEED)



    return () => window.clearInterval(timer)



  }, [state.running])







  const selectedReport = state.selected.type === 'report' ? state.reports.find((report) => report.id === state.selected.value) : undefined



  const selectedSystem = state.selected.type === 'system' ? state.selected.value : 'Power'



  const canCommand = !state.ended && state.running







  function start() { setState((current) => ({ ...current, running: true, log: [...current.log, { time: current.time, kind: 'COMMAND', text: 'Simulation clock started.' }] })) }



  function restart() { setPending(null); setForkDecision(null); setForkResult(null); setCausalAnalysis(null); setRecordedCommands([]); setServerEvaluation(null); setNotice('Scenario reset to the displayed seed.'); setState(freshState()) }



  function confirmCommand(id: string) {



    const def = commandDefs.find((command) => command.id === id)



    if (!def || !canCommand) return



    const missing = commandBlock(def.id, state, selectedReport)



    if (missing) { setNotice(missing); return }



    setState(commitCommand(state, id, selectedReport))



    setRecordedCommands((current) => [...current, { second: state.time, commandId: id, reportId: selectedReport?.id, insertionOrder: current.filter((command) => command.second === state.time).length }])



    setPending(null); setNotice(`${def.name} committed. Resources reserved.`)



  }







  function toggleMotion() { setState((current) => ({ ...current, reducedMotion: !current.reducedMotion })) }



  const focusLabel = state.selected.type === 'edge' ? `Edge ${state.selected.value}` : state.selected.type === 'report' ? `Report ${state.selected.value}` : state.selected.value



  function openFork(command: RecordedCommand) { setForkDecision(command); setForkResult(null); setForkMode('replace'); setForkAlternate(command.commandId === 'shed' ? 'reroute' : command.commandId === 'reroute' ? 'mobile' : 'reroute') }



  function runFork() {



    if (!forkDecision) return



    const operation: BranchOperation = forkMode === 'remove' ? { kind: 'remove', commandId: forkDecision.commandId } : forkMode === 'add' ? { kind: 'add', commandId: forkAlternate, insertionOrder: forkDecision.insertionOrder + 1 } : { kind: 'replace', commandId: forkDecision.commandId, replacementCommandId: forkAlternate }



    try { setForkResult(forkline({ originalCommands: recordedCommands, forkSecond: forkDecision.second, operation })) } catch (error) { setNotice(error instanceof Error ? error.message : 'FORKLINE branch rejected.') }



  }



  function openCausal(event: State['log'][number]) { setCausalAnalysis(analyzeCausalEvent(event, replay(recordedCommands), recordedCommands)) }

  function enterIncident(event: MouseEvent<HTMLAnchorElement>) { event.preventDefault(); setIntroVisible(false); document.getElementById('simulator')?.scrollIntoView({ behavior: state.reducedMotion ? 'auto' : 'smooth' }) }







  return <main className={`shell ${state.reducedMotion ? 'reduced-motion' : 'motion-enabled'}`} data-reduced-motion={state.reducedMotion ? 'true' : 'false'}>



    <header className="topbar">



       <div><p className="eyebrow">CASCADETRACE / CHAIN//REACTION</p><h1>CASCADE<span>//</span>TRACE</h1></div>



        <div className="scenario"><span>CITY//01</span><small>SIMULATOR / 60-SECOND INCIDENT · {backendStatus === 'online' ? 'JAVA API ONLINE' : backendStatus === 'checking' ? 'JAVA API CHECKING' : 'LOCAL ENGINE'}</small></div>



      <div className="clock"><small>SCENARIO CLOCK</small><strong>{displayStamp(state.time)}</strong><i className={state.ended ? 'ended' : state.running ? 'live' : ''}></i></div>



    </header>



    {introVisible && <HeroBriefing state={state} enterIncident={enterIncident} />}

    <section className="mission-hud" aria-label="Mission HUD"><div><span>POWER DEFICIT</span><strong>{number(deficit(state), 0)} MW</strong></div><div><span>SYSTEMS AT RISK</span><strong>{systems.filter((system) => systemStatus(state, system) !== 'NORMAL').length} / {systems.length}</strong></div><div className={`hud-debt debt-${decisionDebt(state).toLowerCase()}`} title="Delayed consequences created by prior interventions."><span>DECISION DEBT</span><strong>{decisionDebt(state)}</strong></div><div><span>TIME LEFT / ELAPSED</span><strong>{stamp(remainingDisplaySeconds(state.time))} / {stamp(elapsedDisplaySeconds(state.time))}</strong></div></section>



    <section className="alertbar"><span className="alert-dot"></span><b>ACTIVE INCIDENT</b><span>SUBSTATION S14 / {INCIDENT_LOSS_MW} MW LOSS</span><span className="alert-meta">SEED {seed}</span><button className="secondary-button" onClick={toggleMotion} aria-pressed={state.reducedMotion}>{state.reducedMotion ? 'Motion reduced' : 'Reduce motion'}</button><button className="secondary-button" onClick={restart}>RESTART SCENARIO</button></section>



      <section className="resources">{[['reserve','GRID RESERVE','MW'],['mobile','MOBILE POWER','UNITS'],['teams','FIELD TEAMS','UNITS'],['slots','COMMAND SLOTS','OPEN'],['intel','INTEL CAPACITY','UNITS']].map(([key, label, unit]) => <div className="resource" key={key}><span>{label}</span><strong>{number(state.resources[key as keyof typeof state.resources], 0)}</strong><small>{unit}</small></div>)}</section>



     <div className="workspace" id="simulator">



        <section className="network-panel panel"><Network state={state} onSelect={(selected) => setState((current) => ({ ...current, selected }))} /><div className="legend"><span><i className="legend-line"></i>dependency path</span><span><i className="legend-pulse"></i>active propagation</span></div></section>



          <aside className="side-column"><section className="decision-prompt"><span className="kicker">COMMAND AUTHORITY</span><h2>{state.ended ? 'SCENARIO COMPLETE' : state.running ? 'WHAT WILL YOU DO?' : 'READY FOR INCIDENT'}</h2><p>{state.ended ? 'Scenario ended. Review the recorded evidence below.' : state.running ? 'Choose an intervention and watch the dependency network respond.' : 'The city has lost 180 MW. Start the clock, then choose your interventions.'}</p>{!state.running && !state.ended && <button className="start-button authority-start" onClick={start}>START SIMULATION <b>→</b></button>}</section>{state.running && !state.ended && <CommandPanel state={state} pending={pending} setPending={setPending} confirm={confirmCommand} canCommand={canCommand} selectedReport={selectedReport} />}<Detail state={state} selectedSystem={selectedSystem} selectedReport={selectedReport} focusLabel={focusLabel} onSelect={(selected) => setState((current) => ({ ...current, selected }))} /></aside>



    </div>



    <section className="lower-grid"><NowStrip state={state} /><Feed log={state.log} expanded={timelineExpanded} toggle={() => setTimelineExpanded((value) => !value)} /><div className={timelineExpanded ? 'timeline-expanded' : 'timeline-collapsed'}><Timeline log={state.log} commands={recordedCommands} onDecision={openFork} onCascade={openCausal} review={reviewTimeline} /></div></section>



     <footer className="footerbar"><span>{state.ended ? 'SCENARIO COMPLETE' : state.running ? notice : ''}</span></footer>



      {state.ended && <Outcome state={state} commands={recordedCommands} review={() => setReviewTimeline(true)} fork={openFork} serverEvaluation={serverEvaluation} backendStatus={backendStatus} />}



      {forkDecision && <ForklinePanel decision={forkDecision} mode={forkMode} alternate={forkAlternate} setMode={setForkMode} setAlternate={setForkAlternate} run={runFork} result={forkResult} close={() => { setForkDecision(null); setForkResult(null) }} />}



      {causalAnalysis && <CausalPanel analysis={causalAnalysis} close={() => setCausalAnalysis(null)} />}



  </main>



}







function Network({ state, onSelect }: { state: State; onSelect: (selection: Selection) => void }) {

  const positions = { Power: [50, 48], Telecom: [20, 18], Traffic: [20, 78], Water: [50, 90], Hospital: [82, 78], [SYSTEM_NAMES.emergencyServices]: [82, 18] } satisfies Record<SystemName, [number, number]>

  const routes: Record<string, string> = { 'Power->Traffic': 'M50 48 C42 58 32 68 20 78', [`Traffic->${SYSTEM_NAMES.emergencyServices}`]: 'M20 78 C35 91 68 91 82 18' }

  const statusCounts = systems.reduce<Record<Status, number>>((counts, system) => { counts[systemStatus(state, system)] += 1; return counts }, { NORMAL: 0, STRESSED: 0, DEGRADED: 0, CRITICAL: 0 })

  const [hoveredSystem, setHoveredSystem] = useState<SystemName | null>(null)

  return <section className="network-shell"><div className="network-heading"><div><span className="kicker">LIVE INCIDENT / CITY//01</span><h2>Dependency network</h2><div className="health-rail"><span>{systems.length} SYSTEMS</span><span>{statusCounts.NORMAL} NORMAL</span><span>{statusCounts.STRESSED} STRESSED</span><span>{statusCounts.DEGRADED} DEGRADED</span><span>{statusCounts.CRITICAL} CRITICAL</span></div></div><span className={`live-tag ${state.running && !state.ended ? 'live-now' : ''}`}>{state.ended ? 'SCENARIO ENDED' : state.running ? 'LIVE ●' : 'STANDBY'}</span></div><div className="city-pulse">{systems.map((system) => <button key={system} className={`pulse-chip ${statusClass(systemStatus(state, system))}`} onClick={() => onSelect({ type: 'system', value: system })}><span>{displayName(system)}</span><b>{systemStatus(state, system)}</b></button>)}</div><div className="network" aria-label="Interactive six-system dependency network"><svg viewBox="0 0 100 100" role="img" aria-label="Directed infrastructure dependency graph"><defs><marker id="arrow" markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4 z" fill="#6B7280" /></marker></defs>{edges.map(([from, to, quantity]) => { const [x1, y1] = positions[from]; const [x2, y2] = positions[to]; const key = `${from}->${to}`; const selected = state.selected.type === 'edge' && state.selected.value === key; const active = state.activeEdges.includes(key); const related = !hoveredSystem || hoveredSystem === from || hoveredSystem === to; const threshold = state.log.some((event) => event.kind === 'CASCADE' && event.time === state.time && event.sourceSystem === from && event.targetSystem === to); const className = `edge ${selected ? 'selected-edge' : ''} ${threshold ? 'threshold-edge' : active ? 'active-edge' : 'normal-edge'} ${related ? '' : 'edge-muted'}`; return <g key={key} className={className} onClick={() => onSelect({ type: 'edge', value: key })} tabIndex={0} role="button" aria-label={`${displayName(from)} to ${displayName(to)}, affects ${quantity}`} onKeyDown={(event: KeyboardEvent<SVGGElement>) => { if (event.key === 'Enter' || event.key === ' ') onSelect({ type: 'edge', value: key }) }}><path className="edge-path" d={routes[key] ?? `M${x1} ${y1} L${x2} ${y2}`} /><text x={(x1 + x2) / 2} y={(y1 + y2) / 2} className="edge-label">{quantity}</text></g>})}</svg>{systems.map((system) => { const [left, top] = positions[system]; const selected = state.selected.type === 'system' && state.selected.value === system; const status = systemStatus(state, system); const related = !hoveredSystem || hoveredSystem === system || edges.some(([from, to]) => (from === hoveredSystem && to === system) || (to === hoveredSystem && from === system)); return <button key={system} className={`node node-${slugify(system)} ${selected ? 'selected-node' : ''} ${statusClass(status)} ${related ? '' : 'node-muted'}`} style={{ left: `${left}%`, top: `${top}%` }} onMouseEnter={() => setHoveredSystem(system)} onMouseLeave={() => setHoveredSystem(null)} onFocus={() => setHoveredSystem(system)} onBlur={() => setHoveredSystem(null)} onClick={() => onSelect({ type: 'system', value: system })} aria-label={`Inspect ${displayName(system)}, status ${status}`}><span className="node-status"></span><b>{displayName(system)}</b><small>{status} / {system === 'Power' ? `S14 / ${INCIDENT_LOSS_MW} MW` : system === SYSTEM_NAMES.emergencyServices ? 'COMMAND' : 'SYSTEM'}</small></button>})}</div></section>

}



function Detail({ state, selectedSystem, selectedReport, focusLabel, onSelect }: { state: State; selectedSystem: SystemName; selectedReport?: State['reports'][number]; focusLabel: string; onSelect: (selection: Selection) => void }) {



  const edge = state.selected.type === 'edge' ? edges.find(([from, to]) => `${from}->${to}` === state.selected.value) : undefined



  const quantities = state.values[selectedSystem]



  const cause = causeFor(state, selectedSystem)



  return <section className="detail panel"><div className="panel-head"><div><span className="kicker">02 / INSPECTOR</span><h2>{state.selected.type === 'edge' ? 'Dependency detail' : state.selected.type === 'report' ? 'Field report' : displayName(selectedSystem)}</h2></div><span className="selection-chip">{focusLabel}</span></div>{edge ? <div className="edge-detail"><div className="route"><b>{displayName(edge[0])}</b><span>→</span><b>{displayName(edge[1])}</b></div><p>Source condition propagates through this directed dependency.</p><div className="impact"><span>AFFECTED QUANTITY</span><strong>{edge[2]}</strong></div><p className="muted">Threshold crossings are appended to the timeline and incident feed when material.</p></div> : selectedReport ? <div className="report-detail"><span className={`status status-${slugify(selectedReport.status)}`}>{selectedReport.status}</span><h3>{selectedReport.id} / {selectedReport.title}</h3>{selectedReport.claim && <p>{selectedReport.claim}</p>}{selectedReport.status === 'Unknown' && <p className="muted">Specific fault claim withheld. Verification unavailable.</p>}<small>Seed-resolved field intelligence</small></div> : <><div className="inspector-status"><span className={`status ${statusClass(systemStatus(state, selectedSystem))}`}>{systemStatus(state, selectedSystem)}</span>{cause && <small>CAUSE / {cause.causeId ?? 'dependency-pressure'}</small>}</div><Quantities system={selectedSystem} values={quantities} reserve={state.resources.reserve} /></>}<div className="report-picker"><span className="kicker">FIELD REPORTS / SELECT TARGET</span>{state.reports.map((report) => <button key={report.id} className="report-pick" onClick={() => onSelect({ type: 'report', value: report.id })} aria-label={`Inspect report ${report.id}`}><b>{report.id}</b><span>{report.status}</span></button>)}</div></section>



}



 function Quantities({ system, values, reserve }: { system: SystemName; values: Record<string, number>; reserve: number }) { const displayValues = system === 'Power' ? { ...values, reserve } : values; const labels: Record<string, string> = { generation: 'Generation / MW', demand: 'Demand / MW', reserve: 'Grid Reserve / MW', load: 'Network load / %', capacity: 'Capacity / %', runtime: 'Backup runtime / sec', signal: 'Signal availability / %', throughput: 'Road throughput / %', delay: 'Response delay / min', pumps: 'Pump capacity / %', pressure: 'Pressure / %', arrivals: 'Arrivals / hr', treatment: 'Treatment capacity / %', queue: 'Queue / units', backup: 'Backup power / %', response: 'Response capacity / %', comms: 'Communications quality / %' }; return <><div className="quantity-grid">{Object.entries(displayValues).map(([key, value]) => <div className="quantity" key={key}><span>{labels[key]}</span><strong>{displayValue(key, value)}</strong></div>)}</div><p className="impact-copy"><b>DEPENDENCY IMPACT</b><br />{system === 'Power' ? 'Power deficit is the initiating pressure on four connected systems.' : `Current ${displayName(system)} quantities are evaluated against critical continuity thresholds.`}</p></> }







 function CommandPanel({ state, pending, setPending, confirm, canCommand, selectedReport }: { state: State; pending: string | null; setPending: (id: string | null) => void; confirm: (id: string) => void; canCommand: boolean; selectedReport?: State['reports'][number] }) { return <section className="commands panel"><div className="panel-head"><div><span className="kicker">03 / COMMAND DECK</span><h2>Interventions</h2></div><span className="command-count">{state.active.length} / 2 COMMITTED</span></div><div className="command-list">{commandDefs.map((command) => { const blocked = commandBlock(command.id, state, selectedReport); const selected = pending === command.id; const active = state.active.find((item) => item.id === command.id); return <div className={`command ${selected ? 'command-selected' : ''} ${active ? 'command-active' : ''}`} key={command.id}><button className="command-main" onClick={() => setPending(selected ? null : command.id)} disabled={!canCommand} aria-label={`Inspect ${command.name}`}><span className="command-index">0{commandDefs.indexOf(command) + 1}</span><span><b>{command.name}</b><small>{active ? `IN PROGRESS / COMPLETE ${displayStamp(active.finish)}` : `${command.cost} / ${command.duration}s`}</small></span><span className="command-arrow">{selected ? '−' : '+'}</span></button>{selected && !active && <div className="command-expand"><p><b>REQUIREMENTS</b> {command.requirements}</p><p><b>EFFECT</b> {command.effect}</p>{command.debt && <p className="debt"><b>DECISION DEBT</b> {command.debt}</p>}<button className="confirm" onClick={() => confirm(command.id)} disabled={Boolean(blocked)}>{blocked || 'CONFIRM COMMAND'}</button></div>}</div>})}</div></section> }







function Feed({ log, expanded, toggle }: { log: State['log']; expanded: boolean; toggle: () => void }) {
  type Filter = 'ALL' | 'COMMAND' | 'CASCADE' | 'RECOVERY' | 'DEBT'
  const [filter, setFilter] = useState<Filter>('ALL')
  const feedRef = useRef<HTMLDivElement>(null)
  const userScrolled = useRef(false)
  const notable = log
  const cascades = notable.filter((event) => event.kind === 'CASCADE').length
  const commands = notable.filter((event) => event.kind === 'COMMAND').length
  const recoveries = notable.filter((event) => event.kind === 'RECOVERY').length
  const displayed = notable.filter((event) => filter === 'ALL' || (filter === 'DEBT' ? event.kind === 'DEBT ACTIVE' : event.kind === filter))

  useEffect(() => {
    if (log.length > 0 && feedRef.current && !userScrolled.current) feedRef.current.scrollTop = 0
  }, [log.length])

  return <section className="feed panel"><div className="panel-head"><div><span className="kicker">LATEST EVENTS</span><h2>Current situation <small>{notable.length} EVENTS</small></h2></div><div className="feed-actions"><span className={`feed-live ${log.some((event) => event.kind === 'OUTCOME') ? 'sealed' : 'live'}`}>{log.some((event) => event.kind === 'OUTCOME') ? 'SEALED' : 'LIVE'}</span><span className="activity-summary"><b>{notable.length} EVENTS</b><b>{cascades} CASCADES</b><b>{commands} COMMANDS</b><b>{recoveries} RECOVERY</b></span><button className="timeline-toggle" type="button" onClick={toggle}>{expanded ? 'HIDE FULL TIMELINE' : 'VIEW FULL TIMELINE'}</button></div></div><div className="feed-filters" aria-label="Event filters">{(['ALL','COMMAND','CASCADE','RECOVERY','DEBT'] as Filter[]).map((value) => <button type="button" key={value} className={filter === value ? 'active' : ''} onClick={() => { setFilter(value); userScrolled.current = false }}>{value === 'COMMAND' ? 'COMMANDS' : value}</button>)}</div><div className="feed-list" ref={feedRef} onScroll={(event: UIEvent<HTMLDivElement>) => { userScrolled.current = event.currentTarget.scrollTop > 36 }}>{displayed.slice().reverse().map((event, index) => <div className={`feed-item feed-${slugify(event.kind)}`} key={`${event.time}-${event.text}-${index}`}><span className={`event-mark mark-${slugify(event.kind)}`}></span><div><small>{displayStamp(event.time)} <b className={`event-type type-${slugify(event.kind)}`}>{event.kind}</b></small><p>{visibleEventText(event.text)}</p></div></div>)}</div></section>
}

function NowStrip({ state }: { state: State }) {
  const latest = latestEvent(state.log)
  const atRisk = systems.filter((system) => systemStatus(state, system) !== 'NORMAL').length
  const pressure = deficit(state) > 0 ? `${number(deficit(state), 0)} MW DEFICIT` : 'POWER BALANCED'
  return <div className="now-strip"><div className="now-cell"><small>NOW</small><strong>{state.ended ? 'SEALED' : state.running ? 'LIVE' : 'STANDBY'}</strong></div><div className="now-cell"><small>POWER PRESSURE</small><strong>{pressure}</strong></div><div className="now-cell"><small>SYSTEMS AT RISK</small><strong>{atRisk} / {systems.length}</strong></div><div className="now-cell"><small>LATEST CHANGE</small><strong>{latest ? visibleEventText(latest.text) : 'No events recorded'}</strong></div></div>
}

function HeroBriefing({ state, enterIncident }: { state: State; enterIncident: (event: MouseEvent<HTMLAnchorElement>) => void }) {
  const atRisk = systems.filter((system) => systemStatus(state, system) !== 'NORMAL').length
  const latest = latestEvent(state.log)
  const statusLabel = state.ended ? 'OUTCOME SEALED' : state.running ? '● LIVE' : 'INCIDENT MODEL READY'
  const nodeClass = (system: SystemName) => `signal-node signal-${slugify(system)} ${statusClass(systemStatus(state, system))}`
  return <section className="hero-briefing" aria-label="CITY//01 mission briefing"><div className="briefing-copy"><span className="hero-kicker">CITY//01 / RESILIENCE OPERATIONS <i>{statusLabel}</i></span><h2>Every decision<br />changes the city.</h2><p>Contain a cascading infrastructure failure in 60 seconds. Every intervention changes what happens next.</p><div className="briefing-incident"><span>SUBSTATION S14</span><strong>{INCIDENT_LOSS_MW} MW LOST</strong></div><a className="hero-cta" href="#simulator" onClick={enterIncident}>ENTER INCIDENT <b>→</b></a><small className="cta-note">Simulation starts only when you choose START SIMULATION.</small><div className="feature-modules"><span><b>01</b><strong>DETERMINISTIC</strong><small>Same action. Same result.</small></span><span><b>02</b><strong>CAUSAL X-RAY</strong><small>Understand why systems changed.</small></span><span><b>03</b><strong>FORKLINE</strong><small>Replay another decision.</small></span></div></div><div className="briefing-visual"><div className="city-signal"><div className="signal-title"><span className="hero-kicker">LIVE CITY SIGNAL</span><small>{statusLabel} · {displayStamp(state.time)}</small></div><div className="signal-map"><i className={`signal-line signal-line-a ${state.activeEdges.includes('Power->Telecom') ? 'active' : ''}`}></i><i className={`signal-line signal-line-b ${state.activeEdges.includes('Power->Water') ? 'active' : ''}`}></i>{systems.map((system) => <span key={system} className={nodeClass(system)}>{displayName(system).replace(' Services','')}<b>{systemStatus(state, system)}</b></span>)}<div className="incident-card"><b>INCIDENT 01</b><strong>S14 GRID FAILURE</strong><em>{number(deficit(state), 0)} MW</em><small>{atRisk} / {systems.length} SYSTEMS AT RISK · {stamp(remainingDisplaySeconds(state.time))} LEFT</small></div></div><div className="propagation"><span>FAILURE</span><b>→</b><span>PRESSURE</span><b>→</b><span>CASCADE</span></div></div><div className="why-card"><b>LATEST SIGNAL</b><span>{latest ? visibleEventText(latest.text) : 'S14 loss confirmed.'}</span></div></div><div className="briefing-bottom"><span>ACT <b>→</b> OBSERVE <b>→</b> UNDERSTAND <b>→</b> REPLAY</span><small>Every intervention changes what happens next.</small><div className="briefing-spectrum"><b>CONSEQUENCE SPECTRUM</b><i></i><span>STABLE</span><span>PRESSURE</span><span>CASCADE</span></div><strong>CITY//01 <b>•</b> {INCIDENT_LOSS_MW} MW INCIDENT <b>•</b> {systems.length} SYSTEMS <b>•</b> 60 SECONDS <em>DETERMINISTIC ENGINE</em></strong></div></section>
}

function Timeline({ log, commands, onDecision, onCascade, review }: { log: State['log']; commands: RecordedCommand[]; onDecision: (command: RecordedCommand) => void; onCascade: (event: State['log'][number]) => void; review: boolean }) { return <section className={`timeline panel ${review ? 'timeline-reviewing' : ''}`}><div className="panel-head"><div><span className="kicker">05 / CHRONOLOGY</span><h2>Event timeline</h2></div><span className="timeline-count">{String(log.length).padStart(2, '0')} EVENTS</span></div><div className="timeline-list">{log.map((event, index) => { const decision = event.kind === 'COMMAND' ? commands.find((command) => command.second === event.time && event.text.includes(command.commandId === 'reroute' ? 'Reroute' : command.commandId === 'shed' ? 'Shed' : command.commandId === 'mobile' ? 'Mobile' : command.commandId === 'prioritize' ? 'Prioritize' : command.commandId === 'verify' ? 'Verify' : 'Dispatch')) : undefined; const causal = event.kind === 'CASCADE' || event.kind === 'RECOVERY'; const important = review && (causal || decision); return <div className={`timeline-item ${important ? 'timeline-important' : ''}`} key={`${event.time}-${event.text}-${index}`}><time>{displayStamp(event.time)}</time><span></span><p><b>{event.kind}</b>{decision ? <button type="button" className="decision-link" onClick={() => onDecision(decision)} aria-label={`Fork from ${decision.commandId} at ${displayStamp(decision.second)}`}>{visibleEventText(event.text)} <strong>FORK HERE</strong></button> : causal ? <button type="button" className="causal-link" onClick={() => onCascade(event)} aria-label={`Open causal X-Ray for ${event.text}`}>{visibleEventText(event.text)} <strong>CAUSAL X-RAY</strong></button> : event.text}</p></div>})}</div></section> }







function CausalPanel({ analysis, close }: { analysis: CausalAnalysis; close: () => void }) {



  const composite = analysis.contributors.length > 1



  const target = analysis.selectedEvent.targetSystem ?? 'Unknown'



  const targetMetric = analysis.selectedEvent.metric ?? 'Event'



  const directCause = composite ? `${analysis.contributors.map((node) => node.system ?? 'UNKNOWN').join(' + ')} pressure` : analysis.immediateCause ? `${analysis.immediateCause.system ?? 'UNKNOWN'} → ${analysis.immediateCause.metric ?? 'UNKNOWN'} / ${analysis.immediateCause.causeId ?? 'UNKNOWN'}` : 'UNKNOWN / INCOMPLETE EVIDENCE'



  return <aside className={`causal-drawer panel ${composite ? 'causal-composite' : ''}`} aria-label="Causal X-Ray"><div className="panel-head"><div><span className="kicker">CAUSAL X-RAY / RECORDED EVIDENCE</span><h2>WHY DID THIS HAPPEN?</h2><small>{target} / {targetMetric}</small></div><button type="button" className="drawer-close" onClick={close} aria-label="Close Causal X-Ray">×</button></div><div className="causal-body"><span className={`status status-${analysis.confidence.toLowerCase()}`}>{analysis.confidence}</span><p className="causal-selected">{analysis.selectedEvent.text} / {displayStamp(analysis.selectedEvent.time)}</p><h3>DIRECT CAUSE</h3><p>{directCause}</p>{composite ? <><h3>CONTRIBUTING CAUSES</h3><div className="causal-converging"><div className="causal-contributors">{analysis.contributors.map((node) => <span key={node.id}><b>{node.system ?? 'UNKNOWN'}</b><small>{node.metric ?? 'unknown'} / {node.newValue === undefined ? 'unknown' : displayValue(node.metric ?? '', node.newValue)} / {node.evidence}</small></span>)}</div><div className="causal-converging-target"><b>→ {target} / {targetMetric}</b></div></div></> : <><h3>UPSTREAM CHAIN</h3><div className="causal-chain">{analysis.chain.slice().reverse().map((node, index) => <span key={node.id}>{index > 0 && <b>→</b>}<strong>{node.system ?? 'UNKNOWN'}</strong><small>{node.metric ?? 'unknown'} / {node.causeId ?? 'unknown'}{node.time === undefined ? '' : ` / ${displayStamp(node.time)}`}</small></span>)}</div>{analysis.contributors.length > 0 && <><h3>CONTRIBUTING CAUSES</h3><div className="causal-contributors">{analysis.contributors.map((node) => <span key={node.id}><b>{node.system ?? 'UNKNOWN'}</b><small>{node.metric ?? 'unknown'} / {node.newValue === undefined ? 'unknown' : displayValue(node.metric ?? '', node.newValue)} / {node.evidence}</small></span>)}</div></>}</>}{analysis.decisionDebt.length > 0 && <div className="causal-debt"><b>DECISION DEBT</b><p>{analysis.decisionDebt.map((node) => node.causeId).join(' → ')}</p></div>}<h3>EVIDENCE</h3><p>{analysis.completeness}</p></div></aside>



}







function ForklinePanel({ decision, mode, alternate, setMode, setAlternate, run, result, close }: { decision: RecordedCommand; mode: 'remove' | 'replace' | 'add'; alternate: string; setMode: (mode: 'remove' | 'replace' | 'add') => void; setAlternate: (id: string) => void; run: () => void; result: ForkResult | null; close: () => void }) {



  const commandName = (id: string) => commandDefs.find((command) => command.id === id)?.name ?? id



  const formatDelta = (value: number) => `${value > 0 ? '+' : ''}${number(value)}`



  return <aside className="forkline-drawer panel" aria-label="FORKLINE comparison"><div className="panel-head"><div><span className="kicker">FORKLINE / COUNTERFACTUAL BRANCH</span><h2>WHAT IF I CHOSE DIFFERENTLY?</h2></div><button className="drawer-close" onClick={close} aria-label="Close FORKLINE">×</button></div><div className="forkline-body"><div className="fork-path"><span>PAST</span><i></i><b>● FORK {displayStamp(decision.second)}</b><i></i><span>ORIGINAL</span><em>└──────── ALTERNATE</em></div><p className="fork-origin"><b>ORIGINAL DECISION</b> {commandName(decision.commandId)} at {displayStamp(decision.second)}</p><div className="fork-controls"><label>BRANCH <select value={mode} onChange={(event: ChangeEvent<HTMLSelectElement>) => setMode(event.target.value as 'remove' | 'replace' | 'add')}><option value="remove">REMOVE</option><option value="replace">REPLACE</option><option value="add">ADD</option></select></label>{mode !== 'remove' && <label>ALTERNATE COMMAND <select value={alternate} onChange={(event: ChangeEvent<HTMLSelectElement>) => setAlternate(event.target.value)}>{commandDefs.map((command) => <option value={command.id} key={command.id}>{command.name}</option>)}</select></label>}<button className="confirm fork-button" onClick={run}>RUN BRANCH</button></div>{result && <>{!result.branch.accepted ? <div className="fork-rejected">BRANCH REJECTED / {result.branch.reason}</div> : <div className="fork-comparison"><div className="comparison-head"><span>ORIGINAL</span><span>ALTERNATE</span></div><div className="comparison-row"><b>DECISION</b><span>{commandName(decision.commandId)}</span><span>{mode === 'remove' ? 'Removed' : commandName(alternate)}</span></div><div className="comparison-row"><b>FIRST STRESSED</b><span>{result.original.state.log.find((event) => event.kind === 'CASCADE' && event.text.includes('STRESSED'))?.time === undefined ? 'none' : `${displayStamp(result.original.state.log.find((event) => event.kind === 'CASCADE' && event.text.includes('STRESSED'))?.time ?? 0)}`}</span><span>{result.comparison.firstStressed === null ? 'none' : displayStamp(result.comparison.firstStressed ?? 0)}</span></div><div className="comparison-row"><b>FIRST DEGRADED</b><span>{result.original.state.log.find((event) => event.kind === 'CASCADE' && event.text.includes('DEGRADED'))?.time === undefined ? 'none' : displayStamp(result.original.state.log.find((event) => event.kind === 'CASCADE' && event.text.includes('DEGRADED'))?.time ?? 0)}</span><span>{result.comparison.firstDegraded === null ? 'none' : displayStamp(result.comparison.firstDegraded ?? 0)}</span></div><div className="comparison-row"><b>RECOVERY</b><span>{result.original.state.recoveryTime === undefined ? 'none' : displayStamp(result.original.state.recoveryTime)}</span><span>{result.comparison.recoveryTime === null ? 'none' : displayStamp(result.comparison.recoveryTime)}</span></div><div className="comparison-row"><b>FINAL POWER DEFICIT</b><span>{deficit(result.original.state)} MW</span><span>{result.comparison.finalDeficit} MW</span></div><div className="delta-list"><b>METRIC DELTAS / ALTERNATE - ORIGINAL</b>{Object.entries(result.comparison.statusMetricDeltas).map(([system, metrics]) => <div key={system}><strong>{system}</strong> {Object.entries(metrics).map(([metric, delta]) => `${metric} ${formatDelta(delta)}`).join(' · ')}</div>)}</div><div className="delta-list"><b>RESOURCES / ALTERNATE - ORIGINAL</b>{Object.entries(result.comparison.resourceDifferences).map(([resource, delta]) => <span key={resource}>{resource} {formatDelta(delta)}</span>)}</div><div className="fork-events"><div><b>EVENTS PREVENTED</b>{result.comparison.eventsPrevented.slice(0, 4).map((event) => <small key={event}>{event}</small>)}</div><div><b>EVENTS INTRODUCED</b>{result.comparison.eventsIntroduced.slice(0, 4).map((event) => <small key={event}>{event}</small>)}</div></div><div className="fork-why"><b>WHY THEY DIVERGED</b><p>{result.comparison.changedCausalChains.length ? result.comparison.changedCausalChains.join(' · ') : 'No additional causal provenance recorded.'}</p></div></div>}</>}</div></aside>



}



function Outcome({ state, commands, review, fork, serverEvaluation, backendStatus }: { state: State; commands: RecordedCommand[]; review: () => void; fork: (command: RecordedCommand) => void; serverEvaluation: ReplayEvaluation | null; backendStatus: 'checking' | 'online' | 'offline' }) {



  const cascades = state.log.filter((entry) => entry.kind === 'CASCADE'); const recoveries = state.log.filter((entry) => entry.kind === 'RECOVERY'); const firstStressed = cascades.find((entry) => entry.text.includes('STRESSED')); const firstDegraded = cascades.find((entry) => entry.text.includes('DEGRADED')); const debt = state.log.find((entry) => entry.kind === 'DEBT ACTIVE' && entry.causeId === 'load-shed'); const causal = [...state.log].reverse().find((entry) => entry.kind === 'CASCADE' && entry.sourceSystem && entry.targetSystem); const nearMiss = state.log.filter((entry) => entry.kind === 'CASCADE' && typeof entry.newValue === 'number' && entry.newValue > 40 && entry.newValue <= 45).sort((a, b) => (a.newValue ?? 0) - (b.newValue ?? 0))[0];



  const metricValue = (key: string, value: number) => displayValue(key, value); const ledger = commands.map((command) => { const complete = state.log.find((entry) => entry.kind === 'COMPLETE' && entry.time >= command.second && entry.text.toLowerCase().includes(command.commandId === 'reroute' ? 'reroute' : command.commandId === 'shed' ? 'load shed' : command.commandId === 'mobile' ? 'mobile' : command.commandId)); const definition = commandDefs.find((entry) => entry.id === command.commandId); return { command, complete, definition } });



  return <section className="outcome panel aar"><div className="aar-heading"><div><span className="kicker">SCENARIO ENDED / 01:00</span><h2>After Action Review</h2><p>Recorded operational evidence from the CITY//01 incident timeline.</p></div><div className="aar-verification"><span className="live-tag">{serverEvaluation?.verified ? 'SERVER REPLAY VERIFIED' : backendStatus === 'online' ? 'SERVER REPLAY PENDING' : 'LOCAL EVIDENCE SEALED'}</span>{serverEvaluation?.fingerprint && <small title={serverEvaluation.fingerprint}>REPLAY {serverEvaluation.fingerprint.slice(0, 12).toUpperCase()}</small>}</div></div><section className="aar-section"><div className="aar-section-title"><span>01</span><h3>MISSION OUTCOME</h3></div><div className="metric-grid"><div className="metric"><span>Final Power Deficit</span><strong>{number(deficit(state), 0)} MW</strong><small>Final authoritative engine state.</small></div><div className="metric"><span>Cascade Events</span><strong>{cascades.length}</strong><small>Recorded threshold crossings.</small></div><div className="metric"><span>Recovery</span><strong>{state.recoveryTime === undefined ? 'Not achieved' : displayStamp(state.recoveryTime)}</strong><small>Authoritative recovery evidence.</small></div><div className="metric"><span>Decisions Completed</span><strong>{state.completed.length}</strong><small>Completed command evidence.</small></div><div className="metric"><span>Intelligence Verified</span><strong>{state.completed.filter((commandId) => commandId === 'verify').length}</strong><small>Completed Verify command evidence.</small></div><div className="metric"><span>Decision Debt</span><strong>{decisionDebt(state) === 'CLEAR' ? 'CLEAR' : 'ACTIVE'}</strong><small>Recorded DEBT ACTIVE evidence.</small></div></div></section><section className="aar-section"><div className="aar-section-title"><span>02</span><h3>DECISION LEDGER</h3></div>{ledger.length ? <div className="decision-ledger">{ledger.map(({ command, complete, definition }) => <div className="ledger-row" key={`${command.second}-${command.insertionOrder}`}><strong>{definition?.name ?? command.commandId}</strong><span>ISSUED {displayStamp(command.second)}</span><span>{complete ? `COMPLETE ${displayStamp(complete.time)}` : 'UNFINISHED'}</span><small>{definition?.cost ?? 'Recorded command'} / {definition?.effect ?? 'No effect recorded'}{definition?.debt ? ` / DEBT: ${definition.debt}` : ''}</small></div>)}</div> : <p className="muted">No player decisions recorded.</p>}</section><section className="aar-section"><div className="aar-section-title"><span>03</span><h3>CRITICAL MOMENTS</h3></div><div className="moment-list">{[firstStressed, firstDegraded, debt, state.recoveryTime !== undefined ? recoveries.find((entry) => entry.time === state.recoveryTime) : undefined].filter(Boolean).slice(0, 5).map((event) => <div className="moment" key={`${event!.time}-${event!.text}`}><time>{displayStamp(event!.time)}</time><span>{event!.kind}</span><p>{event!.text}</p></div>)}</div></section><section className="aar-section"><div className="aar-section-title"><span>04</span><h3>NEAR MISSES</h3></div>{nearMiss ? <p className="near-miss"><b>{nearMiss.targetSystem} / {nearMiss.metric}</b> reached {metricValue(nearMiss.metric ?? '', nearMiss.newValue ?? 0)} against a critical threshold of 40 at {displayStamp(nearMiss.time)} without crossing it.</p> : <p className="muted">No recorded metric approached a threshold without crossing it.</p>}</section><section className="aar-section"><div className="aar-section-title"><span>05</span><h3>CAUSAL SUMMARY</h3></div>{causal ? <p className="causal-summary">{causal.sourceSystem} → {causal.targetSystem} / {causal.metric} / {causal.causeId ?? 'INCOMPLETE EVIDENCE'}</p> : <p className="muted">INCOMPLETE EVIDENCE / No supported causal chain recorded.</p>}</section><section className="aar-actions"><button className="confirm" onClick={review}>REVIEW TIMELINE</button>{commands.length > 0 && <button className="start-button" onClick={() => fork(commands[commands.length - 1])}>FORK A DECISION <b>→</b></button>}</section></section>



}







createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
