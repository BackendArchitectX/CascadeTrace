import { StrictMode, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { getRun, getRuns, reverifyRun, type SimulationRunDetail, type SimulationRunPage, type SimulationRunSummary } from './api'
import './history.css'

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function shortFingerprint(value: string) {
  return value.length <= 18 ? value : `${value.slice(0, 10)}…${value.slice(-6)}`
}

function HistoryApp() {
  const [page, setPage] = useState<SimulationRunPage | null>(null)
  const [selected, setSelected] = useState<SimulationRunDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [verifyBusy, setVerifyBusy] = useState(false)

  const verifiedCount = useMemo(() => page?.items.filter((run) => run.verified).length ?? 0, [page])

  async function loadRuns() {
    setLoading(true)
    setError('')
    try {
      const result = await getRuns(0, 50)
      setPage(result)
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
    try {
      const refreshed = await reverifyRun(selected.id)
      setSelected(refreshed)
      await loadRuns()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Verification failed.')
    } finally {
      setVerifyBusy(false)
    }
  }

  return <main className="history-shell">
    <header className="history-topbar">
      <div>
        <p className="eyebrow">CASCADETRACE / INCIDENT ARCHIVE</p>
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
        <p>Completed simulations are independently replayed by Java, fingerprinted, and stored with the exact command ledger used to produce the outcome.</p>
      </div>
      <div className="archive-stats">
        <div><span>RECORDED RUNS</span><strong>{page?.totalElements ?? 0}</strong></div>
        <div><span>VERIFIED ON PAGE</span><strong>{verifiedCount}</strong></div>
        <div><span>STORAGE</span><strong>POSTGRESQL</strong></div>
      </div>
    </section>

    {error && <div className="error-banner">{error}</div>}

    <section className="history-grid">
      <div className="run-list panel">
        <div className="panel-head"><div><span>01 / ARCHIVE</span><h3>Simulation runs</h3></div><small>{loading ? 'LOADING' : `${page?.totalElements ?? 0} TOTAL`}</small></div>
        {loading && !page ? <p className="empty">Loading persisted incidents…</p> : page?.items.length ? page.items.map((run) => <button key={run.id} className={`run-row ${selected?.id === run.id ? 'selected' : ''}`} onClick={() => void openRun(run)}>
          <div><b>{run.scenarioId}</b><span>{formatDate(run.recordedAt)}</span></div>
          <div className="run-metrics"><span>{run.finalDeficit} MW</span><span>{run.commandCount} CMD</span><span className={run.verified ? 'verified' : 'unverified'}>{run.verified ? 'VERIFIED' : 'MISMATCH'}</span></div>
        </button>) : <p className="empty">No completed simulations have been recorded yet. Finish a scenario in the live simulator to create the first archive entry.</p>}
      </div>

      <aside className="run-detail panel">
        <div className="panel-head"><div><span>02 / EVIDENCE</span><h3>{selected ? selected.scenarioId : 'Select a run'}</h3></div>{selected && <small>{shortFingerprint(selected.serverEvaluation.fingerprint)}</small>}</div>
        {!selected ? <p className="empty">Choose an archived run to inspect its deterministic evidence.</p> : <>
          <div className="detail-status">
            <span className={selected.serverEvaluation.verified ? 'verified-badge' : 'mismatch-badge'}>{selected.serverEvaluation.verified ? 'SERVER VERIFIED' : 'CLIENT / SERVER MISMATCH'}</span>
            <button onClick={() => void verifySelected()} disabled={verifyBusy}>{verifyBusy ? 'VERIFYING…' : 'REVERIFY'}</button>
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
            <span>REPLAY FINGERPRINT / SHA-256</span>
            <code>{selected.serverEvaluation.fingerprint}</code>
          </section>
        </>}
      </aside>
    </section>
  </main>
}

createRoot(document.getElementById('root')!).render(<StrictMode><HistoryApp /></StrictMode>)
