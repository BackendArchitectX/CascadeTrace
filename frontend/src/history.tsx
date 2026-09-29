import { StrictMode, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  compareRuns,
  getEvidencePackage,
  getRun,
  getRunStats,
  getRuns,
  reverifyRun,
  type ArchiveStats,
  type RunComparison,
  type SimulationRunDetail,
  type SimulationRunPage,
  type SimulationRunSummary,
} from './api'
import './history.css'
import './history-intelligence.css'

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function shortFingerprint(value: string) {
  return value.length <= 18 ? value : `${value.slice(0, 10)}…${value.slice(-6)}`
}

function shortId(value: string) {
  return value.slice(0, 8).toUpperCase()
}

function formatDelta(value: number | null, suffix = '') {
  if (value == null) return '—'
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${value}${suffix}`
}

function HistoryApp() {
  const [page, setPage] = useState<SimulationRunPage | null>(null)
  const [stats, setStats] = useState<ArchiveStats | null>(null)
  const [selected, setSelected] = useState<SimulationRunDetail | null>(null)
  const [comparison, setComparison] = useState<RunComparison | null>(null)
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [verifyBusy, setVerifyBusy] = useState(false)
  const [compareBusy, setCompareBusy] = useState(false)
  const [exportBusy, setExportBusy] = useState(false)

  const verifiedCount = useMemo(() => stats?.verifiedRuns ?? page?.items.filter((run) => run.verified).length ?? 0, [page, stats])

  async function loadRuns() {
    setLoading(true)
    setError('')
    try {
      const [result, archiveStats] = await Promise.all([getRuns(0, 50), getRunStats()])
      setPage(result)
      setStats(archiveStats)
      if (result.items.length > 0 && !selected) {
        setSelected(await getRun(result.items[0].id))
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load incident archive.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadRuns()
  }, [])

  async function openRun(run: SimulationRunSummary) {
    setError('')
    setNotice('')
    try {
      setSelected(await getRun(run.id))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load run details.')
    }
  }

  async function verifySelected() {
    if (!selected) return
    setVerifyBusy(true)
    setError('')
    setNotice('')
    try {
      const refreshed = await reverifyRun(selected.id)
      setSelected(refreshed)
      setNotice('Archived run replayed successfully against the current Java engine.')
      await loadRuns()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Verification failed.')
    } finally {
      setVerifyBusy(false)
    }
  }

  function toggleCompareSelected() {
    if (!selected) return
    setNotice('')
    setComparison(null)
    setCompareIds((current) => {
      if (current.includes(selected.id)) return current.filter((id) => id !== selected.id)
      if (current.length >= 2) {
        setError('Comparison already contains two runs. Clear one before adding another.')
        return current
      }
      setError('')
      return [...current, selected.id]
    })
  }

  async function runComparison() {
    if (compareIds.length !== 2) return
    setCompareBusy(true)
    setError('')
    setNotice('')
    try {
      setComparison(await compareRuns(compareIds[0], compareIds[1]))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to compare archived runs.')
    } finally {
      setCompareBusy(false)
    }
  }

  function clearComparison() {
    setCompareIds([])
    setComparison(null)
    setError('')
    setNotice('')
  }

  async function exportSelected() {
    if (!selected) return
    setExportBusy(true)
    setError('')
    setNotice('')
    try {
      const evidence = await getEvidencePackage(selected.id)
      const payload = JSON.stringify(evidence, null, 2)
      const blob = new Blob([payload], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `cascadetrace-evidence-${selected.scenarioId}-${shortId(selected.id)}.json`
      link.click()
      URL.revokeObjectURL(url)
      setNotice(`Server evidence package exported. Integrity ${shortFingerprint(evidence.evidenceHash)}.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to export server evidence package.')
    } finally {
      setExportBusy(false)
    }
  }

  async function copyFingerprint() {
    if (!selected) return
    try {
      await navigator.clipboard.writeText(selected.serverEvaluation.fingerprint)
      setNotice('Replay fingerprint copied to clipboard.')
    } catch {
      setError('Clipboard access was blocked by the browser.')
    }
  }

  const selectedForCompare = selected ? compareIds.includes(selected.id) : false

  return <main className="history-shell">
    <header className="history-topbar">
      <div>
        <p className="eyebrow">CASCADETRACE / INCIDENT INTELLIGENCE</p>
        <h1>RUN<span>//</span>HISTORY</h1>
      </div>
      <div className="top-actions">
        <a className="secondary-link" href="/">← LIVE SIMULATOR</a>
        <button onClick={() => void loadRuns()} disabled={loading}>REFRESH</button>
      </div>
    </header>

    <section className="history-hero">
      <div>
        <p className="eyebrow">PERSISTENT EVIDENCE / POSTGRESQL</p>
        <h2>Every incident leaves an auditable trail.</h2>
        <p>Completed simulations are independently replayed by Java, fingerprinted, stored with the exact command ledger and available for evidence comparison.</p>
      </div>
      <div className="archive-stats">
        <div><span>RECORDED RUNS</span><strong>{stats?.totalRuns ?? page?.totalElements ?? 0}</strong></div>
        <div><span>SERVER VERIFIED</span><strong>{verifiedCount}</strong></div>
        <div><span>AVG DEFICIT</span><strong>{stats ? `${stats.averageFinalDeficit.toFixed(1)} MW` : '—'}</strong></div>
        <div><span>BEST DEFICIT</span><strong>{stats?.bestFinalDeficit == null ? '—' : `${stats.bestFinalDeficit} MW`}</strong></div>
      </div>
    </section>

    {error && <div className="error-banner">{error}</div>}
    {notice && <div className="notice-banner">{notice}</div>}

    <section className="compare-tray" aria-label="Comparison queue">
      <div>
        <span>COMPARE SET</span>
        <strong>{compareIds.length}/2 RUNS SELECTED</strong>
        <small>Comparison deltas are calculated as RIGHT minus LEFT.</small>
      </div>
      <div className="compare-actions">
        <button onClick={() => void runComparison()} disabled={compareIds.length !== 2 || compareBusy}>{compareBusy ? 'COMPARING…' : 'COMPARE RUNS'}</button>
        <button className="quiet" onClick={clearComparison} disabled={compareIds.length === 0}>CLEAR</button>
      </div>
    </section>

    <section className="history-grid">
      <div className="run-list panel">
        <div className="panel-head"><div><span>01 / ARCHIVE</span><h3>Simulation runs</h3></div><small>{loading ? 'LOADING' : `${page?.totalElements ?? 0} TOTAL`}</small></div>
        {loading && !page ? <p className="empty">Loading persisted incidents…</p> : page?.items.length ? page.items.map((run) => <button key={run.id} className={`run-row ${selected?.id === run.id ? 'selected' : ''} ${compareIds.includes(run.id) ? 'compare-selected' : ''}`} onClick={() => void openRun(run)}>
          <div><b>{run.scenarioId} / {shortId(run.id)}</b><span>{formatDate(run.recordedAt)}</span></div>
          <div className="run-metrics"><span>{run.finalDeficit} MW</span><span>{run.commandCount} CMD</span><span className={run.verified ? 'verified' : 'unverified'}>{run.verified ? 'VERIFIED' : 'MISMATCH'}</span></div>
        </button>) : <p className="empty">No completed simulations have been recorded yet. Finish a scenario in the live simulator to create the first archive entry.</p>}
      </div>

      <aside className="run-detail panel">
        <div className="panel-head"><div><span>02 / EVIDENCE</span><h3>{selected ? `${selected.scenarioId} / ${shortId(selected.id)}` : 'Select a run'}</h3></div>{selected && <small>{shortFingerprint(selected.serverEvaluation.fingerprint)}</small>}</div>
        {!selected ? <p className="empty">Choose an archived run to inspect its deterministic evidence.</p> : <>
          <div className="detail-status">
            <span className={selected.serverEvaluation.verified ? 'verified-badge' : 'mismatch-badge'}>{selected.serverEvaluation.verified ? 'SERVER VERIFIED' : 'CLIENT / SERVER MISMATCH'}</span>
            <div className="detail-actions">
              <button onClick={toggleCompareSelected}>{selectedForCompare ? 'REMOVE COMPARE' : 'ADD TO COMPARE'}</button>
              <button onClick={() => void exportSelected()} disabled={exportBusy}>{exportBusy ? 'EXPORTING…' : 'EXPORT EVIDENCE'}</button>
              <button onClick={() => void verifySelected()} disabled={verifyBusy}>{verifyBusy ? 'VERIFYING…' : 'REVERIFY'}</button>
            </div>
          </div>

          <div className="evidence-grid">
            <article><span>FINAL DEFICIT</span><strong>{selected.serverEvaluation.finalDeficit} MW</strong></article>
            <article><span>CASCADE EVENTS</span><strong>{selected.serverEvaluation.cascadeEvents}</strong></article>
            <article><span>RECOVERY</span><strong>{selected.serverEvaluation.recoveryTime == null ? '—' : `${selected.serverEvaluation.recoveryTime}s`}</strong></article>
            <article><span>DECISION DEBT</span><strong>{selected.serverEvaluation.decisionDebt ? 'ACTIVE' : 'CLEAR'}</strong></article>
          </div>

          <section className="ledger">
            <div className="subhead"><span>COMMAND LEDGER</span><small>{selected.commandCount} RECORDED</small></div>
            {selected.commands.length === 0 ? <p className="empty compact">No interventions were issued during this run.</p> : selected.commands.map((command, index) => <div className="ledger-row" key={`${command.second}-${command.insertionOrder}-${index}`}>
              <span>{String(command.second).padStart(3, '0')}s</span>
              <b>{command.commandId.toUpperCase()}</b>
              <small>{command.reportId ?? '—'}</small>
            </div>)}
          </section>

          <section className="fingerprint">
            <div><span>REPLAY FINGERPRINT / SHA-256</span><button className="copy-button" onClick={() => void copyFingerprint()}>COPY</button></div>
            <code>{selected.serverEvaluation.fingerprint}</code>
          </section>
        </>}
      </aside>
    </section>

    {comparison && <section className="comparison panel">
      <div className="panel-head"><div><span>03 / COUNTERFACTUAL EVIDENCE</span><h3>Run comparison</h3></div><small>RIGHT − LEFT</small></div>
      <div className="comparison-head">
        <article><span>LEFT</span><strong>{comparison.left.scenarioId} / {shortId(comparison.left.id)}</strong><small>{formatDate(comparison.left.recordedAt)}</small></article>
        <div className="versus">VS</div>
        <article><span>RIGHT</span><strong>{comparison.right.scenarioId} / {shortId(comparison.right.id)}</strong><small>{formatDate(comparison.right.recordedAt)}</small></article>
      </div>
      <div className="delta-grid">
        <article><span>FINAL DEFICIT Δ</span><strong>{formatDelta(comparison.finalDeficitDelta, ' MW')}</strong></article>
        <article><span>CASCADE EVENTS Δ</span><strong>{formatDelta(comparison.cascadeEventsDelta)}</strong></article>
        <article><span>RECOVERY Δ</span><strong>{formatDelta(comparison.recoveryTimeDelta, 's')}</strong></article>
        <article><span>FIRST STRESSED Δ</span><strong>{formatDelta(comparison.firstStressedDelta, 's')}</strong></article>
        <article><span>FIRST DEGRADED Δ</span><strong>{formatDelta(comparison.firstDegradedDelta, 's')}</strong></article>
        <article><span>COMMAND COUNT Δ</span><strong>{formatDelta(comparison.commandCountDelta)}</strong></article>
      </div>
      <div className="command-diff">
        <article><span>ONLY IN LEFT</span>{comparison.commandsOnlyInLeft.length ? comparison.commandsOnlyInLeft.map((command) => <code key={command}>{command}</code>) : <small>NONE</small>}</article>
        <article><span>ONLY IN RIGHT</span>{comparison.commandsOnlyInRight.length ? comparison.commandsOnlyInRight.map((command) => <code key={command}>{command}</code>) : <small>NONE</small>}</article>
      </div>
    </section>}
  </main>
}

createRoot(document.getElementById('root')!).render(<StrictMode><HistoryApp /></StrictMode>)
