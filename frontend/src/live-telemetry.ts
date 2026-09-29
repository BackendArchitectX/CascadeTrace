import './live-telemetry.css'

type EdgeSpec = { from: string; to: string }

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
const slug = (value: string) => value.toLowerCase().replace(/\s+/g, '-')
const edgeKey = (edge: EdgeSpec) => `${edge.from}->${edge.to}`

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

    const dependency = dependencyGroup(edge)
    const active = dependency?.classList.contains('active-edge') ?? false
    const threshold = dependency?.classList.contains('threshold-edge') ?? false
    path.classList.toggle('active', active)
    path.classList.toggle('threshold', threshold)
  }

  const citySignal = map.closest('.city-signal')
  citySignal?.classList.toggle('telemetry-live', Boolean(document.querySelector('.clock i.live')))
}

function clearPressureClasses() {
  document.querySelectorAll('.node.sending-pressure, .node.receiving-pressure')
    .forEach((node) => node.classList.remove('sending-pressure', 'receiving-pressure'))
  document.querySelectorAll('.pulse-chip.telemetry-pressure')
    .forEach((chip) => chip.classList.remove('telemetry-pressure'))
}

function pulseChip(system: string) {
  return [...document.querySelectorAll<HTMLButtonElement>('.city-pulse .pulse-chip')]
    .find((chip) => chip.querySelector('span')?.textContent?.trim() === system)
}

function updateDependencyNetwork() {
  clearPressureClasses()
  const active = edges.filter((edge) => {
    const group = dependencyGroup(edge)
    return group?.classList.contains('active-edge') || group?.classList.contains('threshold-edge')
  })

  for (const edge of active) {
    document.querySelector(`.node-${slug(edge.from)}`)?.classList.add('sending-pressure')
    document.querySelector(`.node-${slug(edge.to)}`)?.classList.add('receiving-pressure')
    pulseChip(edge.from)?.classList.add('telemetry-pressure')
    pulseChip(edge.to)?.classList.add('telemetry-pressure')
  }

  const network = document.querySelector<HTMLElement>('.network')
  if (!network) return

  let meter = network.querySelector<HTMLElement>(':scope > .network-live-meter')
  if (!meter) {
    meter = document.createElement('div')
    meter.className = 'network-live-meter'
    meter.innerHTML = '<b>LIVE PROPAGATION</b><span></span>'
    network.appendChild(meter)
  }

  const clock = document.querySelector('.clock strong')?.textContent?.trim() ?? '00:00'
  const isLive = Boolean(document.querySelector('.clock i.live'))
  const ended = Boolean(document.querySelector('.clock i.ended'))
  meter.classList.toggle('is-live', isLive)
  meter.classList.toggle('is-ended', ended)
  const state = ended ? 'SEALED' : isLive ? 'STREAMING' : 'STANDBY'
  const span = meter.querySelector('span')
  if (span) span.textContent = `${active.length} ACTIVE PATH${active.length === 1 ? '' : 'S'} · ${clock} · ${state}`
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

  // The React hero is already backed by the authoritative simulation state.
  // Prevent the original handler from unmounting it; only perform navigation.
  event.preventDefault()
  event.stopPropagation()
  const simulator = document.getElementById('simulator')
  simulator?.scrollIntoView({ behavior: document.querySelector('.shell.reduced-motion') ? 'auto' : 'smooth' })
}

const observer = new MutationObserver(scheduleUpdate)

function boot() {
  document.addEventListener('click', keepLiveCitySignalMounted, true)
  observer.observe(document.getElementById('root') ?? document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true,
    attributeFilter: ['class'],
  })
  window.addEventListener('resize', scheduleUpdate, { passive: true })
  scheduleUpdate()
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true })
else boot()
