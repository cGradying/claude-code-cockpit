import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Quick } from '../types'

// ponytail: assumes the 1h prompt-cache TTL this session runs on; the engine exposes cache_ttl only on model switch
const TTL_MS = 60 * 60 * 1000

const lastAt = atom({ plugin: 'cockpit', key: 'lastAt' } as const, null)
const tick = atom({ plugin: 'cockpit', key: 'tick' } as const, 0)
const next = atom({ plugin: 'cockpit', key: 'next' } as const, null)
// null: 9router never answered this session, so the dot stays hidden
const router = atom({ plugin: 'cockpit', key: 'router' } as const, null)
const quick = atom({ plugin: 'cockpit', key: 'quick' } as const, [])
const quickOpen = atom({ plugin: 'cockpit', key: 'quickOpen' } as const, false)

const ROUTER_URL = 'http://127.0.0.1:20128/v1/models'
const COMPACT_AT = 70

const DEFAULT_QUICK: [RegExp, Quick[]][] = [
  [
    /PUPSISPortal|IntPortal|intportal/,
    [
      { label: 'Rebuild', prompt: 'Rebuild the app and launch it so I can check the latest change.' },
      { label: 'Simulator', prompt: 'Build and run the app in the iOS Simulator and open the live panel.' },
      { label: 'Phone', prompt: 'Build and install the app on my real iPhone, following the phone notes in memory.' },
    ],
  ],
  [
    /Obsidian/,
    [
      { label: 'File → notes', prompt: "Run /file-to-notes on the newest PDF in this course's Resources that has no notes yet." },
      { label: 'Export PDF', prompt: 'Run /export-to-pdf on the note I edited most recently.' },
      { label: 'Assignment', prompt: "Run /assignment-notes on this course's newest assignment." },
    ],
  ],
]

// Worktrees share the main checkout's task list.
const projectRoot = (root: string) => root.replace(/\/\.claude\/worktrees\/[^/]+$/, '')
const nextFile = (root: string) => `${projectRoot(root)}/.claude/NEXT.md`

const firstOpen = (text: string) =>
  text.split('\n').find(line => /^\s*- \[ \]/.test(line))?.replace(/^\s*- \[ \]\s*/, '') ?? null

const continueText = (task: string, file: string) =>
  `Continue with the next task: "${task}". When it is done, check it off in ${file} (- [x]) and add any follow-up tasks as "- [ ]" lines in order.`

const planText = (file: string) =>
  `What's next? Read this project's plan, recent commits and open PRs, then write the next 3 concrete tasks as "- [ ]" lines at the top of ${file}. Don't start them.`

async function loadQuick($: EngineInterface) {
  const root = projectRoot(await $.session.root())
  const file = `${root}/.claude/quick.json`
  const own: Quick[] | null = (await $.fs.exists(file)) ? JSON.parse(await $.fs.read(file)) : null
  const found = own ?? DEFAULT_QUICK.find(([re]) => re.test(root))?.[1] ?? []
  await update($, quick, () => found.slice(0, 4))
}

async function pulse($: EngineInterface) {
  await update($, tick, n => n + 1)
  const isUp = await $.http
    .fetch(ROUTER_URL)
    .then(r => r.status < 500)
    .catch(() => false)
  const was = await read($, router)
  const now = isUp ? true : was === null ? null : false
  if (now !== was) await update($, router, () => now)
}

// A press queues a prompt, so a double click (or a click before the band redraws) would send it twice.
let lastSent = { text: '', at: 0 }

async function send($: EngineInterface, text: string) {
  const now = await $.clock.now()
  if (lastSent.text === text && now - lastSent.at < 10_000) return
  lastSent = { text, at: now }
  await $.prompt.submit({ text, asUser: true })
}

async function loadNext($: EngineInterface) {
  const file = nextFile(await $.session.root())
  const text = (await $.fs.exists(file)) ? await $.fs.read(file) : ''
  await update($, next, () => firstOpen(text))
  return { file, text }
}

export const register: Register = on => {
  on('session.start', async ($, e, nextHook) => {
    if (e.seconds_since_last_response !== undefined) {
      const at = (await $.clock.now()) - e.seconds_since_last_response * 1000
      await update($, lastAt, () => at)
    }
    await loadNext($)
    await $.command.register({
      name: 'next',
      description: 'Next task: /next <text> adds one on top, /next done checks it off',
    })
    await loadQuick($).catch(() => undefined)
    void pulse($)
    $.clock.every(30_000, () => void pulse($))

    return nextHook(e)
  })

  let warnedCompact = false
  on('turn.complete', async ($, e, nextHook) => {
    const pct = (await $.session.usage()).context.percent ?? 0
    if (pct >= COMPACT_AT && !warnedCompact) $.ui.toast(`Context at ${pct}%: compact soon, the band has a button that keeps the plan.`)
    warnedCompact = pct >= COMPACT_AT

    if (e.agentId === undefined && e.usage) {
      const at = await $.clock.now()
      await update($, lastAt, () => at)
    }
    const { file, text } = await loadNext($)
    const task = firstOpen(text)
    if (e.agentId === undefined && task) void $.prompt.suggest({ text: continueText(task, file) })

    return nextHook(e)
  })

  on('command.run', { command: 'next' }, async ($, e) => {
    const { file, text } = await loadNext($)
    const arg = e.args.trim()
    if (arg === '') return { text: `next › ${firstOpen(text) ?? 'nothing queued'}  (${file})` }

    const updated =
      arg === 'done'
        ? text.replace(/^(\s*- )\[ \]/m, '$1[x]')
        : `- [ ] ${arg}\n${text}`
    await $.fs.write(file, updated)
    await loadNext($)

    return { text: arg === 'done' ? 'Checked off.' : `Queued: ${arg}` }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, nextHook) => {
    if (e.props.hasSurvey) return nextHook(e)

    // What other plugins draw in this slot (replay hint, reflect proposal, ...) sits beneath our row.
    const below = await nextHook(e)
    if (e.surface === 'terminal') await read($, tick)
    const at = await read($, lastAt)
    const task = await read($, next)
    const usage = await $.session.usage()
    const now = await $.clock.now()
    const limit = (kind: string) => usage.rateLimits.find(r => r.kind === kind)?.percentUsed

    const view: View = {
      isWorking: e.props.isWorking,
      left: at === null ? null : TTL_MS - (now - at),
      ctx: usage.context.tokens,
      ctxPct: usage.context.percent,
      five: limit('five_hour'),
      week: limit('seven_day'),
      usd: usage.cost?.usd,
      task,
      router: (await read($, router)) ?? undefined,
      at,
      now,
    }
    const shortcuts = await read($, quick)
    const needsCompact = (view.ctxPct ?? 0) >= COMPACT_AT
    const { Box, Text, Button, Svg } = $.ui.resolve(e) as { Box: any; Text: any; Button: any; Svg: any }
    const file = nextFile(await $.session.root())
    const isDesktop = e.surface !== 'terminal'
    const isPlain = isDesktop || undefined
    const isQuickOpen = isDesktop && (await read($, quickOpen))
    const button = (key: string, label: string, hotkey: string, onPress: () => void, isPrimary = false) => (
      <Button key={key} label={label} variant={isPrimary ? 'primary' : 'secondary'} plain={isPlain} hotkey={hotkey} onPress={onPress} />
    )
    const quickButtons = shortcuts.map((q, i) => button(`quick-${i}`, q.label, String(i + 1), () => void send($, q.prompt)))
    const mainButtons = [
      needsCompact &&
        button('compact', `Compact ${view.ctxPct}%`, 'k', () =>
          // A press's own work is dropped when the press ends, so /compact starts from a timer and the
          // timer returns the run, which keeps its dispatch alive until compaction is done.
          void $.clock.after(1, () =>
            $.command
              .run({
                command: 'compact',
                args: `Keep the current plan, the open tasks in ${file}, open PRs, decisions made and unresolved bugs.`,
              })
              .catch((error: unknown) => $.ui.toast(`Compacting failed: ${error instanceof Error ? error.message : String(error)}`)),
          ), true),
      task && button('continue', 'Continue', 'c', () => void send($, continueText(task, file)), true),
      button('plan', "What's next?", 'n', () => void send($, planText(file))),
    ]
    // Desktop keeps one fixed slot: the shortcuts swap in behind More, so nothing beside the card resizes.
    const actions = view.isWorking ? null : isDesktop ? (
      <Box flexDirection="row" gap={2} flexWrap="nowrap">
        {isQuickOpen ? quickButtons : mainButtons}
        {shortcuts.length > 0 &&
          button(isQuickOpen ? 'back' : 'more', isQuickOpen ? 'Back' : 'More', 'm', () => void update($, quickOpen, open => !open))}
      </Box>
    ) : (
      <Box flexDirection="row" gap={1} flexWrap="wrap">
        {mainButtons}
        {quickButtons}
      </Box>
    )

    if (e.surface !== 'terminal') {
      // ponytail: ~8px per column is a guess at the desktop's cell width; tune if the row overflows
      const SLOT = 34 // columns for the button slot, reserved even while a turn runs
      const width = Math.max(420, Math.min(1400, (e.props.bodyColumns - SLOT) * 8))
      const drawn = cardOnce(view, width)
      return (
        <Box flexDirection="column">
          <Box flexDirection="row" alignItems="center" gap={1}>
            <Box flexShrink={0} width={Math.ceil(width / 8)}>
              <Svg source={drawn.svg} alt={drawn.alt} width={width} height={HEIGHT} isInteractive />
            </Box>
            <Box width={SLOT} flexShrink={0} overflow="hidden">
              {actions}
            </Box>
          </Box>
          {below}
        </Box>
      )
    }

    const tone = cacheTone(view)
    return (
      <Box flexDirection="column">
        <Text>
          <Text color={TERM[tone.kind]}>{view.isWorking ? '✻' : '●'} {tone.label}</Text>
          <Text dimColor>{stats(view).map(p => ` │ ${p}`).join('')}</Text>
        </Text>
        <Text wrap="truncate-end">
          <Text color={TERM.clay}>next › </Text>
          {task ?? <Text dimColor>nothing queued · /next &lt;task&gt;</Text>}
        </Text>
        {actions}
        {below}
      </Box>
    )
  })
}

type View = {
  isWorking: boolean
  left: number | null
  ctx?: number
  ctxPct?: number
  five?: number
  week?: number
  usd?: number
  router?: boolean
  task: string | null
  at: number | null
  now: number
}

type Kind = 'warm' | 'low' | 'cold' | 'working'

const HEIGHT = 30
const TERM: Record<Kind | 'clay', string> = {
  warm: 'green',
  low: 'yellow',
  cold: 'red',
  working: '#d97757',
  clay: '#d97757',
}

function cacheTone(v: View): { kind: Kind; label: string; frac: number } {
  if (v.isWorking) return { kind: 'working', label: 'cache refreshing', frac: 1 }
  if (v.left === null) return { kind: 'cold', label: 'cache cold', frac: 0 }
  if (v.left <= 0) return { kind: 'cold', label: 'cache expired', frac: 0 }
  const mins = Math.ceil(v.left / 60_000)
  return {
    kind: v.left > 10 * 60_000 ? 'warm' : 'low',
    label: `cache warm ${mins}m`,
    frac: v.left / TTL_MS,
  }
}

function stats(v: View): string[] {
  return [
    v.ctx === undefined ? null : `ctx ${(v.ctx / 1000).toFixed(1)}k`,
    v.five === undefined ? null : `5h ${Math.round(v.five)}%`,
    v.week === undefined ? null : `week ${Math.round(v.week)}%`,
    v.usd === undefined ? null : `session $${v.usd.toFixed(2)}`,
    v.router === undefined ? null : `9router ${v.router ? 'up' : 'DOWN'}`,
  ].filter((p): p is string => p !== null)
}

function plain(v: View): string {
  return `${cacheTone(v).label}; ${stats(v).join(', ')}; next: ${v.task ?? 'nothing queued'}`
}

const esc = (t: string) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Text widths for layout: labels in the system sans, numbers in tabular mono.
const SANS = 6.6
const MONO = 7.2

// ---- motion: animate what changed since the last drawing, never a plain redraw ----

type Field = 'spawn' | 'task' | 'kind' | 'refill' | 'router' | 'compact'
type Motion = {
  since: Partial<Record<Field, number>>
  wasTask: string | null
  wasKind: Kind
  wasFrac: number
}

const WINDOW = 900 // longest entrance plus slack; a redraw inside it resumes, not restarts
let seen: { task: string | null; kind: Kind; frac: number; at: number | null; router?: boolean; compact: boolean } | null =
  null
const changedAt: Partial<Record<Field, number>> = {}
let wasTask: string | null = null
let wasKind: Kind = 'cold'
let wasFrac = 0

function motionFor(v: View): Motion {
  const tone = cacheTone(v)
  const compact = (v.ctxPct ?? 0) >= COMPACT_AT
  if (seen === null) {
    changedAt.spawn = v.now
  } else {
    if (seen.task !== v.task) ((wasTask = seen.task), (changedAt.task = v.now))
    if (seen.kind !== tone.kind) ((wasKind = seen.kind), (changedAt.kind = v.now))
    if (seen.at !== v.at && v.at !== null && seen.at !== null) ((wasFrac = seen.frac), (changedAt.refill = v.now))
    if (seen.router !== v.router) changedAt.router = v.now
    if (!seen.compact && compact) changedAt.compact = v.now
  }
  seen = { task: v.task, kind: tone.kind, frac: tone.frac, at: v.at, router: v.router, compact }

  const since: Motion['since'] = {}
  for (const [field, at] of Object.entries(changedAt) as [Field, number][]) {
    if (v.now - at < WINDOW) since[field] = v.now - at
  }
  return { since, wasTask, wasKind, wasFrac }
}

// `class` and `style` that play keyframes `name`, already `elapsed` ms in
const play = (name: string, elapsed: number | undefined, delay = 0) =>
  elapsed === undefined ? '' : ` m ${name}" style="animation-delay:${delay - elapsed}ms`

const TONE_FILL: Record<Kind, string> = { warm: 'var(--ok)', low: 'var(--mid)', cold: 'var(--bad)', working: 'var(--clay)' }

function meter(x: number, label: string, value: string, pct: number | undefined, delay: number, spawn?: number, glow?: number): [string, number] {
  const w = 18
  const fill = pct === undefined ? 0 : Math.max(0, Math.min(1, pct / 100))
  const cls = pct === undefined ? 'ok' : pct >= 85 ? 'bad' : pct >= 60 ? 'mid' : 'ok'
  const barX = x + label.length * SANS + 5
  const valueX = barX + w + 5
  return [
    `<g class="${play('rise', spawn, delay)}">` +
      `<text x="${x}" y="${BASE}" class="label">${esc(label)}</text>` +
      `<rect x="${barX}" y="${MID - 1.5}" width="${w}" height="3" rx="1.5" class="track"/>` +
      `<rect x="${barX}" y="${MID - 1.5}" width="${(w * fill).toFixed(1)}" height="3" rx="1.5" class="g m-${cls}${play('glow', glow)}"/>` +
      `<text x="${valueX}" y="${BASE}" class="num">${esc(value)}</text></g>`,
    valueX + value.length * MONO,
  ]
}

const MID = 15 // the row's optical center
const BASE = 19 // text baseline

let built: { key: string; svg: string; alt: string } | null = null

// The SVG and its alt as of the last change of anything they show; the countdown runs inside the SVG.
function cardOnce(v: View, W: number): { svg: string; alt: string } {
  const { now, left, ...shown } = v
  const key = JSON.stringify({ ...shown, W })
  if (built?.key !== key) built = { key, svg: card(v, W, motionFor(v)), alt: plain(v) }
  return built
}

function card(v: View, W: number, mo: Motion): string {
  const tone = cacheTone(v)
  const { since } = mo
  const spawn = since.spawn
  const R = 6
  const C = 2 * Math.PI * R
  const dash = (f: number) => (C * (1 - f)).toFixed(2)
  const cx = 14

  // The ring is a fuse: it drains on its own clock and refills when a turn re-caches.
  // Times are ms from when this SVG loads; it is rebuilt only when the data changes.
  const L = tone.kind === 'warm' || tone.kind === 'low' ? (v.left ?? 0) : 0
  const lowAt = L - 10 * 60_000
  const refill = since.refill
  const ringAnims = [
    refill === undefined ? null : `refill .7s cubic-bezier(.16,1,.3,1) ${-refill}ms both`,
    L > 0 ? `drain ${L}ms linear ${refill === undefined ? 0 : Math.max(0, 700 - refill)}ms forwards` : null,
    lowAt > 0 ? `toLow .4s ease ${lowAt}ms forwards` : null,
    L > 0 ? `toBad .4s ease ${L}ms forwards` : null,
  ].filter(Boolean)
  const dotAnims = [
    since.kind === undefined ? null : `pop .32s cubic-bezier(.16,1,.3,1) ${-since.kind}ms both`,
    lowAt > 0 ? `toLowF .4s ease ${lowAt}ms forwards` : null,
    L > 0 ? `toBadF .4s ease ${L}ms forwards` : null,
  ].filter(Boolean)
  const haloAnims = L > 0 ? [`halo 1.4s cubic-bezier(.16,1,.3,1) ${Math.max(0, lowAt)}ms infinite`, `gone .01s linear ${L}ms forwards`] : []

  const ring =
    tone.kind === 'working'
      ? `<g class="${play('rise', spawn)}"><g class="g spin">` +
        [0, 60, 120].map(a => `<rect x="${cx - 0.9}" y="${MID - 6}" width="1.8" height="12" rx=".9" transform="rotate(${a} ${cx} ${MID})"/>`).join('') +
        `</g></g>`
      : `<g class="${play('rise', spawn)}">` +
        `<circle cx="${cx}" cy="${MID}" r="${R}" class="track-ring"/>` +
        `<circle cx="${cx}" cy="${MID}" r="${R}" class="ring" stroke="${TONE_FILL[tone.kind]}" stroke-dasharray="${C.toFixed(2)}"` +
        ` stroke-dashoffset="${dash(tone.frac)}" transform="rotate(-90 ${cx} ${MID})"` +
        ` style="--from:${dash(mo.wasFrac)};--to:${dash(tone.frac)};--d0:${dash(tone.frac)};--d1:${dash(0)};animation:${ringAnims.join(',') || 'none'}"/>` +
        (refill === undefined ? '' : `<circle cx="${cx}" cy="${MID}" r="${R}" class="flare m flash" style="animation-delay:${-refill}ms"/>`) +
        `<circle cx="${cx}" cy="${MID}" r="2" fill="${TONE_FILL[tone.kind]}" class="g" style="animation:${dotAnims.join(',') || 'none'}"/>` +
        (haloAnims.length ? `<circle cx="${cx}" cy="${MID}" r="2" fill="var(--mid)" class="g halo" style="animation:${haloAnims.join(',')}"/>` : '') +
        `</g>`

  // Warm cache shows only its minutes, each label switched on and off at its own time.
  let x = 26
  const parts: string[] = []
  let stateW: number
  if (L > 0) {
    const labels: string[] = []
    for (let m = Math.ceil(L / 60_000); m >= 1; m--) {
      const on = Math.max(0, L - m * 60_000)
      const off = L - (m - 1) * 60_000
      const fill = m <= 10 ? 'var(--mid)' : 'var(--ok)'
      labels.push(
        `<text x="${x}" y="${BASE}" class="num state tick" fill="${fill}" style="${
          on === 0 ? `opacity:1;animation:off .01s linear ${off}ms forwards` : `animation:on .01s linear ${on}ms forwards,off .01s linear ${off}ms forwards`
        }">${m}m</text>`,
      )
    }
    labels.push(
      `<text x="${x}" y="${BASE}" class="state tick" fill="var(--bad)" style="animation:on .01s linear ${L}ms forwards">expired</text>`,
    )
    parts.push(`<g class="${play('rise', spawn)}">${labels.join('')}</g>`)
    stateW = 3 * MONO
  } else {
    const word = tone.kind === 'working' ? 'working' : v.left === null ? 'cold' : 'expired'
    parts.push(
      `<text x="${x}" y="${BASE}" class="state${play('tint', since.kind)}" fill="${TONE_FILL[tone.kind]}"${
        since.kind === undefined ? '' : ` style="--was:${TONE_FILL[mo.wasKind]};animation-delay:${-since.kind}ms"`
      }>${word}</text>`,
    )
    stateW = word.length * SANS
  }
  x += stateW + 16

  const metric = (label: string, value: string, pct: number | undefined, delay: number, glow?: number) => {
    const [svg, end] = meter(x, label, value, pct, delay, spawn, glow)
    parts.push(svg)
    x = end + 14
  }
  if (v.ctx !== undefined)
    metric('ctx', `${(v.ctx / 1000).toFixed(1)}k`, v.ctxPct, `Context ${v.ctx.toLocaleString()} tokens${v.ctxPct === undefined ? '' : `, ${v.ctxPct}% of the window`}`, 40, since.compact)
  if (v.five !== undefined) metric('5h', `${Math.round(v.five)}%`, v.five, 70)
  if (v.week !== undefined) metric('wk', `${Math.round(v.week)}%`, v.week, 100)
  if (v.usd !== undefined) {
    const value = `$${v.usd.toFixed(2)}`
    parts.push(`<g class="${play('rise', spawn, 130)}"><text x="${x}" y="${BASE}" class="num dim">${value}</text></g>`)
    x += value.length * MONO + 12
  }
  if (v.router !== undefined) {
    const pop = since.router ?? spawn
    const col = v.router ? 'var(--ok)' : 'var(--bad)'
    parts.push(
      `<g class="${play('rise', spawn, 160)}">` +
        `<rect x="${x - 4}" y="${MID - 7}" width="${v.router ? 14 : 62}" height="14" fill="transparent"/>` +
        `<circle cx="${x + 3}" cy="${MID}" r="2.6" fill="${col}" class="g${play('pop', pop)}"/>` +
        (since.router === undefined ? '' : `<circle cx="${x + 3}" cy="${MID}" r="2.6" class="g ripple m ring-out" stroke="${col}" style="animation-delay:${-since.router}ms"/>`) +
        (v.router ? '' : `<circle cx="${x + 3}" cy="${MID}" r="2.6" fill="var(--bad)" class="g halo"/><text x="${x + 10}" y="${BASE}" class="label down">9router</text>`) +
        `</g>`,
    )
    x += v.router ? 18 : 62
  }

  // The next task takes whatever the row has left.
  const taskX = x + 10
  const room = Math.max(8, Math.floor((W - taskX - 46) / 6.1))
  const clip = (t: string) => (t.length > room ? `${t.slice(0, room - 1)}…` : t)
  const nextLabel = `<text x="${taskX}" y="${BASE}" class="next${play('rise', spawn, 190)}">Next</text>`
  const tx = taskX + 34
  const task = v.task
    ? `<text x="${tx}" y="${BASE}" class="task${play('rise', since.task ?? spawn, since.task === undefined ? 210 : 90)}">${esc(clip(v.task))}</text>`
    : `<text x="${tx}" y="${BASE}" class="task empty${play('rise', since.task ?? spawn, 210)}">nothing queued</text>`
  const leaving =
    since.task !== undefined && mo.wasTask
      ? `<text x="${tx}" y="${BASE}" class="task m leave" style="animation-delay:${-since.task}ms">${esc(clip(mo.wasTask))}</text>`
      : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${HEIGHT}" viewBox="0 0 ${W} ${HEIGHT}">
<style>
  svg { color-scheme: dark light; background: var(--bg);
        --bg:#212121; --fg:#ebe9e1; --dim:#8e8b83; --track:rgba(255,255,255,.08);
        --clay:#d97757; --ok:#6cc085; --mid:#e3a84f; --bad:#ec6a5e; }
  @media (prefers-color-scheme: light) {
    svg { --bg:#faf9f5; --fg:#1f1e1d; --dim:#6b675f; --track:rgba(31,30,29,.09);
          --clay:#c15f3c; --ok:#2e8b4c; --mid:#a86d12; --bad:#c2410c; }
  }
  text:not([fill]) { fill: var(--fg); }
  .label { font: 500 11px ui-sans-serif, -apple-system, system-ui, sans-serif; fill: var(--dim); }
  .label.down { fill: var(--bad); font-weight: 600; }
  .num { font: 500 11.5px ui-monospace, "SF Mono", Menlo, monospace; font-variant-numeric: tabular-nums; }
  .dim { fill: var(--dim); }
  .state { font-weight: 600; font-family: ui-sans-serif, -apple-system, system-ui, sans-serif; font-size: 11.5px; }
  .num.state { font-family: ui-monospace, "SF Mono", Menlo, monospace; }
  .task { font: 400 12px ui-sans-serif, -apple-system, system-ui, sans-serif; }
  .task.empty { fill: var(--dim); }
  .next { font: 600 11px ui-sans-serif, -apple-system, system-ui, sans-serif; fill: var(--clay); }
  .track { fill: var(--track); }
  .track-ring { fill: none; stroke: var(--track); stroke-width: 1.8; }
  .ring { fill: none; stroke-width: 1.8; stroke-linecap: round; }
  .flare { fill: none; stroke: var(--clay); stroke-width: 1.8; opacity: 0; }
  .m-ok { fill: var(--ok); } .m-mid { fill: var(--mid); } .m-bad { fill: var(--bad); }
  .spin rect { fill: var(--clay); }
  .g { transform-box: fill-box; transform-origin: center; }
  .ripple { fill: none; stroke-width: 1.2; opacity: 0; }

  .m { animation-duration: .45s; animation-timing-function: cubic-bezier(.16,1,.3,1); animation-fill-mode: both; }
  .rise { animation-name: rise; }
  .leave { animation-name: leave; animation-duration: .16s; animation-timing-function: cubic-bezier(.7,0,.84,0); }
  .pop { animation-name: pop; animation-duration: .32s; }
  .ring-out { animation-name: ringout; animation-duration: .6s; }
  .tint { animation-name: tint; animation-duration: .5s; }
  .glow { animation-name: glow; animation-duration: .8s; }
  .refill { animation-name: refill; animation-duration: .7s; }
  .flash { animation-name: flash; animation-duration: .7s; }
  .spin { animation: spin 1.6s linear infinite; }
  .halo { opacity: 0; }
  .tick { opacity: 0; }

  @keyframes rise { from { opacity: 0; transform: translateY(4px); filter: blur(1.5px); } to { opacity: 1; transform: none; filter: none; } }
  @keyframes leave { to { opacity: 0; transform: translateY(-5px); filter: blur(1.5px); } }
  @keyframes pop { from { transform: scale(0); } to { transform: scale(1); } }
  @keyframes ringout { from { opacity: .7; transform: scale(1); } to { opacity: 0; transform: scale(3.2); } }
  @keyframes tint { from { fill: var(--was); } }
  @keyframes glow { 0% { filter: drop-shadow(0 0 0 var(--mid)); } 35% { filter: drop-shadow(0 0 3px var(--mid)); } 100% { filter: none; } }
  @keyframes refill { from { stroke-dashoffset: var(--from); } to { stroke-dashoffset: var(--to); } }
  @keyframes flash { 0% { opacity: .9; stroke-width: 3; } 100% { opacity: 0; stroke-width: 1.8; } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes drain { from { stroke-dashoffset: var(--d0); } to { stroke-dashoffset: var(--d1); } }
  @keyframes toLow { to { stroke: var(--mid); } }
  @keyframes toBad { to { stroke: var(--bad); } }
  @keyframes toLowF { to { fill: var(--mid); } }
  @keyframes toBadF { to { fill: var(--bad); } }
  @keyframes on { to { opacity: 1; } }
  @keyframes off { to { opacity: 0; } }
  @keyframes gone { to { visibility: hidden; } }
  @keyframes halo { from { opacity: .5; transform: scale(1); } to { opacity: 0; transform: scale(3.4); } }

  @media (prefers-reduced-motion: reduce) {
    .rise, .leave, .pop, .ring-out { animation-name: fade; }
    .leave { animation-direction: reverse; }
    .spin, .halo { animation: none !important; }
    .refill, .flash { animation-duration: .01s; }
    @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
  }
</style>
<rect width="${W}" height="${HEIGHT}" fill="var(--bg)"/>
${ring}
${parts.join('\n')}
${nextLabel}
${leaving}
${task}
</svg>`
}
