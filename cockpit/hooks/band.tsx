import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import {
  COMPACT_AT,
  GIT_PANEL,
  PANEL,
  PANEL_TITLE,
  ROUTER_URL,
  TTL_MS,
  DEFAULT_QUICK,
  cacheTone,
  continueText,
  firstOpen,
  heat,
  isLightTheme,
  palette,
  tint,
  nextFile,
  openTasks,
  projectRoot,
} from './shared'
import type { Quick } from '../types'

const lastAt = atom({ plugin: 'cockpit', key: 'lastAt' } as const, null)
const tick = atom({ plugin: 'cockpit', key: 'tick' } as const, 0)
const next = atom({ plugin: 'cockpit', key: 'next' } as const, null)
const tasks = atom({ plugin: 'cockpit', key: 'tasks' } as const, [])
// null: 9router never answered this session, so it stays hidden
const router = atom({ plugin: 'cockpit', key: 'router' } as const, null)
const quick = atom({ plugin: 'cockpit', key: 'quick' } as const, [])

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

async function loadNext($: EngineInterface) {
  const file = nextFile(await $.session.root())
  const text = (await $.fs.exists(file)) ? await $.fs.read(file) : ''
  const list = openTasks(text)
  await update($, next, () => list[0] ?? null)
  await update($, tasks, () => list.slice(0, 5))
  return { file, text }
}

// A press queues a prompt, so a double click (or a click before the view redraws) would send it twice.
let lastSent = { text: '', at: 0 }

async function send($: EngineInterface, text: string) {
  const now = await $.clock.now()
  if (lastSent.text === text && now - lastSent.at < 10_000) return
  lastSent = { text, at: now }
  await $.prompt.submit({ text, asUser: true })
}

// A press's own work is dropped when the press ends, so /compact starts from a timer and the timer
// returns the run, which keeps its dispatch alive until compaction is done.
function compactNow($: EngineInterface, file: string) {
  void $.clock.after(1, () =>
    $.command
      .run({
        command: 'compact',
        args: `Keep the current plan, the open tasks in ${file}, open PRs, decisions made and unresolved bugs.`,
      })
      .catch((error: unknown) => $.ui.toast(`Compacting failed: ${error instanceof Error ? error.message : String(error)}`)),
  )
}

const openGit = ($: EngineInterface) => $.ui.open({ id: GIT_PANEL, title: 'Git' })

async function openPanel($: EngineInterface) {
  return $.ui.open({ id: PANEL, title: PANEL_TITLE })
}


// The one-line band above the prompt. It carries only what you glance at; the rest is in the panel.
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
    await $.command.register({
      name: 'cockpit',
      description: 'Open the cockpit panel: cache, context, limits, cost and the next tasks',
    })
    await $.command.register({
      name: 'git',
      description: 'Open the git panel: branch, open and stacked PRs, worktrees and what is safe to tidy up',
    })
    await loadQuick($).catch(() => undefined)
    void pulse($)
    $.clock.every(30_000, () => void pulse($))

    return nextHook(e)
  })

  let warnedCompact = false
  on('turn.complete', async ($, e, nextHook) => {
    const pct = (await $.session.usage()).context.percent ?? 0
    if (pct >= COMPACT_AT && !warnedCompact) $.ui.toast(`Context at ${pct}%: compact soon. The cockpit panel has a button that keeps the plan.`)
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

  on('command.run', { command: 'cockpit' }, async $ => {
    const opened = await openPanel($)
    return { text: opened.isPlaced ? 'Cockpit panel opened.' : `The panel waits: ${opened.reason}` }
  })

  on('command.run', { command: 'git' }, async $ => {
    const opened = await openGit($)
    return { text: opened.isPlaced ? 'Git panel opened.' : `The panel waits: ${opened.reason}` }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, nextHook) => {
    if (e.props.hasSurvey) return nextHook(e)

    // What other plugins draw in this slot (replay hint, reflect proposal, ...) sits beneath our row.
    const below = await nextHook(e)
    await read($, tick) // the 30-second pulse redraws the countdown
    const at = await read($, lastAt)
    const task = await read($, next)
    const usage = await $.session.usage()
    const now = await $.clock.now()
    const limit = (kind: string) => usage.rateLimits.find(r => r.kind === kind)?.percentUsed
    const file = nextFile(await $.session.root())

    const cache = cacheTone({ isWorking: e.props.isWorking, left: at === null ? null : TTL_MS - (now - at) })
    const ctxPct = usage.context.percent
    const needsCompact = (ctxPct ?? 0) >= COMPACT_AT
    const isUp = await read($, router)
    const { Box, Text, Button } = $.ui.resolve(e)
    const pal = palette(isLightTheme(await $.config.list().catch(() => [])))

    // One piece of the stats: a dim label and a value that turns amber, then red, as it fills.
    const stat = (label: string, value: string, pct?: number) => (
      <Text>
        <Text dimColor>{label} </Text>
        <Text color={tint(heat(pct), pal)}>{value}</Text>
      </Text>
    )
    // Limits only earn a place on the line once they are worth noticing; the panel always shows them.
    const five = limit('five_hour')
    const week = limit('seven_day')

    const stats = (
      <Box flexDirection="row" gap={2} flexShrink={0}>
        <Text bold color={tint(cache.color, pal)}>
          {cache.glyph} {cache.label}
        </Text>
        {usage.context.tokens !== undefined &&
          stat('ctx', `${(usage.context.tokens / 1000).toFixed(1)}k${ctxPct !== undefined && ctxPct >= 60 ? ` ${ctxPct}%` : ''}`, ctxPct)}
        {five !== undefined && five >= 60 && stat('5h', `${Math.round(five)}%`, five)}
        {week !== undefined && week >= 60 && stat('wk', `${Math.round(week)}%`, week)}
        {isUp === false && <Text color={pal.hot}>9router down</Text>}
      </Box>
    )

    const upNext = (
      <Box flexGrow={1} flexShrink={1} minWidth={10}>
        <Text wrap="truncate-end">
          <Text bold color={pal.accent}>
            Next{' '}
          </Text>
          {task ?? <Text dimColor>nothing queued</Text>}
        </Text>
      </Box>
    )

    const buttons = (
      <Box flexDirection="row" gap={2} flexShrink={0}>
        {!e.props.isWorking && needsCompact && (
          <Button key="compact" plain hotkey="k" onPress={() => compactNow($, file)}>
            <Text bold color={pal.accent}>{`[ Compact ${ctxPct}% ]`}</Text>
          </Button>
        )}
        {!e.props.isWorking && task && (
          <Button key="continue" plain hotkey="c" onPress={() => void send($, continueText(task, file))}>
            <Text bold color={pal.accent}>[ Continue ]</Text>
          </Button>
        )}
        <Button key="git" plain hotkey="g" onPress={() => void openGit($)}>
          <Text>[ Git ]</Text>
        </Button>
        <Button key="details" plain hotkey="d" onPress={() => void openPanel($)}>
          <Text>[ Details ]</Text>
        </Button>
      </Box>
    )

    // Wide: one row. Narrow: the stats on their own row so the task and buttons keep room.
    const isNarrow = (e.props.bodyColumns ?? 120) < 72
    return (
      <Box flexDirection="column">
        {isNarrow ? (
          <Box flexDirection="column">
            {stats}
            <Box flexDirection="row" gap={2}>
              {upNext}
              {buttons}
            </Box>
          </Box>
        ) : (
          <Box flexDirection="row" alignItems="center" gap={3}>
            {stats}
            {upNext}
            {buttons}
          </Box>
        )}
        {below}
      </Box>
    )
  })
}
