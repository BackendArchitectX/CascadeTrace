import './live-telemetry.css'

type EdgeSpec = { from: string; to: string }
type Severity = 'normal' | 'stressed' | 'degraded' | 'critical'

const edges: EdgeSpec[] = [
  { from: 'Power', to: 'Telecom' },
  { from: 'Power', to: 'Traffic' },
  { from: 'Power', to: 'Water' },
  { from: 'Power', to: 'Hospital' },
  { from: 'Telecom', to: 'Emergency Services' },
  { from: 'Traffic', to: 'Emergency Services' },
  { from: 'Water', to: 'Hospital' },
  { from: 'Emergency Services', to: 'Hospital' },
]

const SVG_NS = 'http://www.w3.org/2000/svg'
const THRESHOLD_HOLD_MS = 1100
const slug = (value: string) => value.toLowerCase().replace(/\s+/g, '-')
const edgeKey = (edge: EdgeSpec) => `${edge.from}->${edge.to}`
const recentThresholdUntil = new Map<string, number>()
const previousStatuses = new Map<string, Severity>()

function severityOf(element: Element | null): Severity {
  if (!element) return 'normal'
  if (element.classList.contains('status-critical')) return 'critical'
  if (element.classList.contains('status-degraded')) return 'degraded'
  if (element.classList.contains('status-stressed')) return 'stressed'
  return 'normal'
}

function dependencyGroup(edge: EdgeSpec) {
  const prefix = `${edge.from} to ${edge.to},`
  return [...document.querySelectorAll<SVGGElement>('.network .edge')]
    .find((group) => group.getAttribute('aria-label')?.startsWith(prefix))
}

function ensureHeroSvg(map: HTMLElement) {
  let svg = map.querySelector<SVGSVGElement>(':scope > .signal-live-links')
  if (svg) return svg

  svg = document.createElementNS(SVG_NS, 'svg')
  svg.classList.add('signal-live-links')
  svg.setAttribute('aria-hidden', 'true')

  const defs = document.createElementNS(SVG_NS, 'defs')
  const marker = document.createElementNS(SVG_NS, 'marker')
  marker.setAttribute('id', 'hero-live-arrow')
  marker.setAttribute('markerWidth', '7')
  marker.setAttribute('markerHeight', '7')
  marker.setAttribute('refX', '6')
  marker.setAttribute('refY', '3.5')
  marker.setAttribute('orient', 'auto')
  const arrow = document.createElementNS(SVG_NS, 'path')
  arrow.setAttribute('d', 'M0,0 L7,3.5 L0,7 z')
  arrow.setAttribute('class', 'hero-live-arrow')
  arrow.setAttribute('fill', 'context-stroke')
  marker.appendChild(arrow)
  defs.appendChild(marker)
  svg.appendChild(defs)

  for (const edge of edges) {
    const path = document.createElementNS(SVG_NS, 'path')
    path.dataset.edge = edgeKey(edge)
    path.classList.add('hero-live-edge')
    path.setAttribute('marker-end', 'url(#hero-live-arrow)')
    svg.appendChild(path)
  }

  map.prepend(svg)
  return svg
}

function nodeCenter(mapRect: DOMRect, node: Element) {
  const rect = node.getBoundingClientRect()
  return {
    x: rect.left - mapRect.left + rect.width / 2,
    y: rect.top - mapRect.top + rect.height / 2,
  }
}

function edgeState(edge: EdgeSpec) {
  const key = edgeKey(edge)
  const group = dependencyGroup(edge)
  const thresholdNow = group?.classList.contains('threshold-edge') ?? false
  if (thresholdNow) recentThresholdUntil.set(key, Date.now() + THRESHOLD_HOLD_MS)

  const thresholdRecent = (recentThresholdUntil.get(key) ?? 0) > Date.now()
  if (!thresholdRecent) recentThresholdUntil.delete(key)

  const active = Boolean(group?.classList.contains('active-edge') || thresholdNow || thresholdRecent)
  const target = document.querySelector(`.network .node-${slug(edge.to)}`)
  return { group, active, thresholdNow, thresholdRecent, severity: severityOf(target) }
}

function updateHeroNetwork() {
  const map = document.querySelector<HTMLElement>('.signal-map')
  if (!map || map.clientWidth === 0 || map.clientHeight === 0) return

  const svg = ensureHeroSvg(map)
  const mapRect = map.getBoundingClientRect()
  svg.setAttribute('viewBox', `0 0 ${mapRect.width} ${mapRect.height}`)

  for (const edge of edges) {
    const source = map.querySelector(`.signal-${slug(edge.from)}`)
    const target = map.querySelector(`.signal-${slug(edge.to)}`)
    const path = svg.querySelector<SVGPathElement>(`[data-edge="${edgeKey(edge)}"]`)
    if (!source || !target || !path) continue

    const a = nodeCenter(mapRect, source)
    const b = nodeCenter(mapRect, target)
    const dx = b.x - a.x
    const dy = b.y - a.y
    const bend = Math.min(36, Math.max(10, Math.abs(dx) * 0.08 + Math.abs(dy) * 0.05))
    const cx = (a.x + b.x) / 2 + (dy > 0 ? bend : -bend) * 0.2
    const cy = (a.y + b.y) / 2 + (dx > 0 ? -bend : bend) * 0.2
    path.setAttribute('d', `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`)

    const state = edgeState(edge)
    path.className.baseVal = `hero-live-edge telemetry-${state.severity}${state.active ? ' active' : ''}${state.thresholdRecent ? ' threshold' : ''}`
  }

  const citySignal = map.closest('.city-signal')
  citySignal?.classList.toggle('telemetry-live', Boolean(document.querySelector('.clock i.live')))
}

function clearPressureClasses() {
  document.querySelectorAll('.node.sending-pressure, .node.receiving-pressure')
    .forEach((node) => node.classList.remove('sending-pressure', 'receiving-pressure'))
  document.querySelectorAll('.pulse-chip.telemetry-pressure')
    .forEach((chip) => chip.classList.remove('telemetry-pressure'))
  document.querySelectorAll('.network .edge.telemetry-stressed, .network .edge.telemetry-degraded, .network .edge.telemetry-critical, .network .edge.telemetry-normal, .network .edge.recent-threshold')
    .forEach((edge) => edge.classList.remove('telemetry-stressed', 'telemetry-degraded', 'telemetry-critical', 'telemetry-normal', 'recent-threshold'))
}

function pulseChip(system: string) {
  return [...document.querySelectorAll<HTMLButtonElement>('.city-pulse .pulse-chip')]
    .find((chip) => chip.querySelector('span')?.textContent?.trim() === system)
}

function transitionKey(element: Element, prefix: string, index: number) {
  const namedClass = [...element.classList].find((name) => name.startsWith(prefix))
  return namedClass ?? `${prefix}${index}`
}

function trackStatusTransitions() {
  const tracked = [
    ...document.querySelectorAll('.network .node'),
    ...document.querySelectorAll('.signal-map .signal-node'),
  ]

  tracked.forEach((element, index) => {
    const key = transitionKey(element, element.classList.contains('node') ? 'node-' : 'signal-', index)
    const severity = severityOf(element)
    const previous = previousStatuses.get(key)
    previousStatuses.set(key, severity)
    if (!previous || previous === severity) return

    element.classList.remove('telemetry-transition')
    requestAnimationFrame(() => element.classList.add('telemetry-transition'))
    window.setTimeout(() => element.classList.remove('telemetry-transition'), 900)
  })
}

function ensureThresholdLegend() {
  const legend = document.querySelector<HTMLElement>('.network-panel > .legend')
  if (!legend || legend.querySelector('.legend-threshold-label')) return

  const item = document.createElement('span')
  item.className = 'legend-threshold-label'
  item.innerHTML = '<i class="legend-threshold"></i>threshold crossing'
  legend.appendChild(item)
}

function updateDependencyNetwork() {
  clearPressureClasses()
  let activeCount = 0

  for (const edge of edges) {
    const state = edgeState(edge)
    if (!state.group) continue

    state.group.classList.add(`telemetry-${state.severity}`)
    if (state.thresholdRecent) state.group.classList.add('recent-threshold')
    if (!state.active) continue

    activeCount += 1
    document.querySelector(`.node-${slug(edge.from)}`)?.classList.add('sending-pressure')
    document.querySelector(`.node-${slug(edge.to)}`)?.classList.add('receiving-pressure')
    pulseChip(edge.from)?.classList.add('telemetry-pressure')
    pulseChip(edge.to)?.classList.add('telemetry-pressure')
  }

  trackStatusTransitions()
  ensureThresholdLegend()

  const network = document.querySelector<HTMLElement>('.network')
  if (!network) return

  let meter = network.querySelector<HTMLElement>(':scope > .network-live-meter')
  if (!meter) {
    meter = document.createElement('div')
    meter.className = 'network-live-meter'
    meter.innerHTML = '<b>LIVE PROPAGATION</b><span></span><small></small>'
    network.appendChild(meter)
  }

  const clock = document.querySelector('.clock strong')?.textContent?.trim() ?? '00:00'
  const isLive = Boolean(document.querySelector('.clock i.live'))
  const ended = Boolean(document.querySelector('.clock i.ended'))
  const atRisk = document.querySelectorAll('.network .node.status-stressed, .network .node.status-degraded, .network .node.status-critical').length
  const worst: Severity = document.querySelector('.network .node.status-critical') ? 'critical'
    : document.querySelector('.network .node.status-degraded') ? 'degraded'
      : document.querySelector('.network .node.status-stressed') ? 'stressed' : 'normal'

  meter.classList.toggle('is-live', isLive)
  meter.classList.toggle('is-ended', ended)
  meter.dataset.severity = worst
  const stateLabel = ended ? 'SEALED' : isLive ? 'STREAMING' : 'STANDBY'
  const span = meter.querySelector('span')
  const small = meter.querySelector('small')
  if (span) span.textContent = `${activeCount} ACTIVE PATH${activeCount === 1 ? '' : 'S'} · ${clock} · ${stateLabel}`
  if (small) small.textContent = `${atRisk} / 6 SYSTEMS AT RISK · WORST ${worst.toUpperCase()}`
}

let scheduled = false
function scheduleUpdate() {
  if (scheduled) return
  scheduled = true
  requestAnimationFrame(() => {
    scheduled = false
    updateHeroNetwork()
    updateDependencyNetwork()
  })
}

function keepLiveCitySignalMounted(event: MouseEvent) {
  const target = event.target as Element | null
  const link = target?.closest<HTMLAnchorElement>('.hero-cta')
  if (!link) return

  // Keep the state-backed city signal mounted while navigating into the simulator.
  event.preventDefault()
  event.stopPropagation()
  const simulator = document.getElementById('simulator')
  simulator?.scrollIntoView({ behavior: document.querySelector('.shell.reduced-motion') ? 'auto' : 'smooth' })
}

const observer = new MutationObserver(scheduleUpdate)
let resizeObserver: ResizeObserver | null = null

function boot() {
  document.addEventListener('click', keepLiveCitySignalMounted, true)
  observer.observe(document.getElementById('root') ?? document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true,
    attributeFilter: ['class'],
  })

  if ('ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(scheduleUpdate)
    const map = document.querySelector('.signal-map')
    const network = document.querySelector('.network')
    if (map) resizeObserver.observe(map)
    if (network) resizeObserver.observe(network)
  } else {
    window.addEventListener('resize', scheduleUpdate, { passive: true })
  }

  scheduleUpdate()
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true })
else boot()
