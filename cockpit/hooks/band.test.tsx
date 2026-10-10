import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const ROOT = '/work/IntPortal/.claude/worktrees/some-branch'
const NEXT = '/work/IntPortal/.claude/NEXT.md'
const PROPS = { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 120 } as never
const PANE_PROPS = { title: 'Cockpit', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} } as never
const RESET = new Date(1_000_000 + (2 * 60 + 10) * 60_000).toISOString() // 2h 10m after the mocked clock

type Opts = { five?: number; week?: number; router?: boolean; tasks?: string }

function engine(on: On, pct: number, opts: Opts = {}) {
  const sent: string[] = []
  const commands: string[] = []
  const opened: string[] = []
  const clock = mock.clock(on, { now: 1_000_000 } as never)
  on('session.root', () => ({ value: ROOT }))
  // another plugin's band, drawn beneath ours
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['below-plugin'] }) as never)
  on('session.usage', () => ({ value: {
    startedAt: 0,
    context: { tokens: 72_500, window: 200_000, percent: pct },
    rateLimits: [
      { kind: 'five_hour', percentUsed: opts.five ?? 10, resetsAt: RESET },
      { kind: 'seven_day', percentUsed: opts.week ?? 59 },
    ],
    cost: { usd: 0.21 },
  } }) as never)
  on('fs.exists', (_, e) => ({ value: JSON.stringify(e).includes(NEXT) }))
  on('fs.read', () => ({ value: opts.tasks ?? '- [x] F1 tokens\n- [ ] Write PLAN-2.md\n- [ ] Later thing\n' }))
  on('http.fetch', () => ({ value: { status: opts.router === false ? 503 : 200, ok: opts.router !== false, headers: {}, text: '{}' } }))
  on('command.register', (_, e) => ({ value: { command: e.name } }) as never)
  on('process.run', (_, e) => {
    const argv = (e as unknown as { argv: string[] }).argv.join(' ')
    const out = (stdout: string) => ({ value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }) as never
    if (argv.startsWith('git status')) return out('## claude/feat...origin/claude/feat [ahead 1]\n M a.ts\n?? b.ts\n')
    if (argv.startsWith('git symbolic-ref')) return out('origin/main\n')
    if (argv.startsWith('git worktree')) return out('worktree /r\nbranch refs/heads/main\n\nworktree /r/w\nbranch refs/heads/old-pr\n')
    if (argv.startsWith('git branch')) return out('main\nold-pr\n')
    if (argv.includes('--state open')) return out(JSON.stringify([{ number: 72, title: 'Signing', headRefName: 'a', baseRefName: 'main', isDraft: false, statusCheckRollup: [{ status: 'COMPLETED', conclusion: 'SUCCESS' }] }, { number: 73, title: 'Eight servers', headRefName: 'b', baseRefName: 'a', isDraft: false, statusCheckRollup: [] }]))
    if (argv.includes('--state merged')) return out('[{"headRefName":"old-pr"}]')
    return out('')
  })
  on('command.run', (_, e) => {
    commands.push(`${e.command} ${e.args}`)
    return { text: '' }
  })
  on('prompt.submit', (_, e) => {
    sent.push(e.text)
    return { text: e.text }
  })
  on('prompt.suggest', () => ({ isShown: true }) as never)
  on('ui.open', (_, e) => {
    opened.push((e as unknown as { id: string }).id)
    return { value: { isPlaced: true } } as never
  })
  return { sent, commands, opened, clock }
}

const start = async ($: Engine, seconds?: number) =>
  $.session.start({ cwd: ROOT, source: 'startup', ...(seconds === undefined ? {} : { seconds_since_last_response: seconds }) } as never).catch(() => undefined)
const band = ($: Engine, surface: 'terminal' | 'desktop', over: object = {}) =>
  $.ui.mount({ plugin: 'cockpit', surface, component: 'AbovePrompt', props: { ...(PROPS as object), ...over } as never })
const panel = ($: Engine, surface: 'terminal' | 'desktop') =>
  $.ui.mount({ plugin: 'cockpit', surface, component: 'Pane', requestId: 'cockpit', props: PANE_PROPS })
const text = async (ui: { drawn: () => Promise<unknown> }) => JSON.stringify(await ui.drawn())

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface} band: one native row, only what you glance at`, async ($, on) => {
    const { sent, clock } = engine(on, 30)
    await start($, 60)
    await clock.settle()
    const ui = await band($, surface)
    const tree = await text(ui)

    expect(tree).toContain('Write PLAN-2.md') // plain text, so the app truncates it itself
    expect(tree).toContain('72.5k')
    expect(tree).toContain('below-plugin') // another plugin's band sits beneath ours
    expect(tree).not.toContain('"type":"Svg"')
    expect(tree).not.toContain('59%') // limits below 60% stay in the panel
    expect(tree).not.toContain('0.21') // so does the cost
    expect(await ui.find({ key: 'compact' })).toBeUndefined()
    expect(await ui.findAll({ type: 'Button' })).toHaveLength(3) // continue, git, details

    await ui.press({ key: 'continue' })
    await ui.press({ key: 'continue' })
    expect(sent).toHaveLength(1) // a double press sends once
    expect(sent[0]).toContain('Write PLAN-2.md')
    expect(sent[0]).toContain(NEXT)
  })

  test(`${surface} band: a limit appears on the line once it passes 60%`, async ($, on) => {
    const { clock } = engine(on, 30, { five: 71, week: 91 })
    await start($)
    await clock.settle()
    const tree = await text(await band($, surface))
    expect(tree).toContain('71%')
    expect(tree).toContain('91%')
  })

  test(`${surface} band: Details opens the cockpit panel`, async ($, on) => {
    const { opened, clock } = engine(on, 30)
    await start($)
    await clock.settle()
    const ui = await band($, surface)
    await ui.press({ key: 'details' })
    expect(opened).toEqual(['cockpit'])
  })

  test(`${surface}: /cockpit opens the panel`, async ($, on) => {
    const { opened, clock } = engine(on, 30)
    await start($)
    await clock.settle()
    const r = await $.command.run({ command: 'cockpit', args: '', origin: { kind: 'person' }, presentation: { isFullscreen: false, columns: 120 } } as never)
    expect(JSON.stringify(r)).toContain('opened')
    expect(opened).toEqual(['cockpit'])
  })

  test(`${surface} band: the cache label counts down from the last response`, async ($, on) => {
    const { clock } = engine(on, 30)
    await start($, 18 * 60) // last answered 18 minutes ago
    await clock.settle()
    expect(await text(await band($, surface))).toContain('42m')
  })

  test(`${surface} band: an expired cache says so`, async ($, on) => {
    const { clock } = engine(on, 30)
    await start($, 90 * 60)
    await clock.settle()
    expect(await text(await band($, surface))).toContain('expired')
  })

  test(`${surface} band: 9router shows only once it has answered and then stops`, async ($, on) => {
    const { clock } = engine(on, 30, { router: false })
    await start($)
    await clock.settle()
    // never answered, so it stays hidden rather than crying wolf on a machine without 9router
    expect(await text(await band($, surface))).not.toContain('9router')
  })

  test(`${surface} band: offers Compact past 70% and keeps the plan`, async ($, on) => {
    const { commands, clock } = engine(on, 82)
    await start($)
    await clock.settle()
    const ui = await band($, surface)

    expect(await text(ui)).toContain('82%')
    await ui.press({ key: 'compact' })
    expect(commands).toHaveLength(0) // started from a timer, not inside the press
    await clock.advance(10)
    expect(commands[0]).toContain('compact Keep the current plan')
  })

  test(`${surface} band: while a turn runs only Details stays, and the numbers`, async ($, on) => {
    const { clock } = engine(on, 30)
    await start($)
    await clock.settle()
    const ui = await band($, surface, { isWorking: true })
    expect(await ui.findAll({ type: 'Button' })).toHaveLength(2) // git, details
    expect(await text(ui)).toContain('working')
    expect(await text(ui)).toContain('72.5k')
  })

  test(`${surface} band: a narrow window stacks the stats above the task`, async ($, on) => {
    const { clock } = engine(on, 30)
    await start($)
    await clock.settle()
    const wide = await text(await band($, surface, { bodyColumns: 140 }))
    const narrow = await text(await band($, surface, { bodyColumns: 60 }))
    expect(narrow).not.toBe(wide)
    expect(narrow).toContain('Write PLAN-2.md')
  })

  test(`${surface} panel: every number with room, limits with their reset`, async ($, on) => {
    const { clock } = engine(on, 36)
    await start($, 18 * 60)
    await clock.settle()
    const tree = await text(await panel($, surface))

    for (const word of ['Prompt cache', '42m left', 'Context', '72.5k tokens', '36%', '200k', '"width":"36%"', 'Plan limits', '5-hour limit', 'Weekly limit', 'resets in 2h 10m', '$0.21', 'Next up', 'Write PLAN-2.md', 'Later thing', 'Mods', 'Agents & progress', 'File tree', 'Replay', 'Skin', 'Reflect', 'Keep-warm', 'Shortcuts', 'Rebuild']) {
      expect(tree).toContain(word)
    }
    if (surface === 'desktop') expect(tree).toContain('xmlns=') // the header drawing is an image, which needs its namespace
    expect(tree).toContain('#a6e22e') // Monokai green
  })

  test(`${surface} panel: bar widths are whole percentages, which is all the app accepts`, async ($, on) => {
    const { clock } = engine(on, 36.4)
    await start($, 7) // answered seven seconds ago: 99.8% of the hour is left
    await clock.settle()
    const tree = await text(await panel($, surface))
    const widths = [...tree.matchAll(/"width":"([^"]+)"/g)].map(m => m[1])
    expect(widths.length).toBeGreaterThan(3)
    for (const w of widths) expect(w).toMatch(/^\d+%$/)
  })

  test(`${surface} panel: the empty part of a bar follows the app theme`, async ($, on) => {
    const { clock } = engine(on, 36)
    on('config.list', () => ({ value: [{ key: 'theme', label: 'Theme', kind: 'choice', value: 'light', provider: { plugin: 'engine', tier: 'core' }, isLocked: false }] }) as never)
    await start($)
    await clock.settle()
    const tree = await text(await panel($, surface))
    expect(tree).toContain('#e6e3dc')
    expect(tree).toContain('#4d7c0f') // deeper green on the light theme
  })

  test(`${surface} panel: dark by default`, async ($, on) => {
    const { clock } = engine(on, 36)
    await start($)
    await clock.settle()
    expect(await text(await panel($, surface))).toContain('#3e3d32')
  })

  test(`${surface} panel: its buttons act`, async ($, on) => {
    const { sent, commands, clock } = engine(on, 36)
    await start($)
    await clock.settle()
    const ui = await panel($, surface)

    await ui.press({ key: 'continue' })
    expect(sent[0]).toContain('Write PLAN-2.md')
    await ui.press({ key: 'plan' })
    expect(sent[1]).toContain("What's next?")
    await ui.press({ key: 'quick-1' })
    expect(sent[2]).toContain('iOS Simulator')
    await ui.press({ key: 'compact' })
    await clock.advance(10)
    expect(commands[0]).toContain('compact Keep the current plan')

    await ui.press({ key: 'Agents & progress-Open' })
    await ui.press({ key: 'Skin-Noir' })
    await ui.press({ key: 'Keep-warm-Stop' })
    await clock.advance(10)
    expect(commands.slice(1).map(c => c.trim())).toEqual(['agents-info', 'skin noir', 'keepwarm off'])
  })

  test(`${surface} git panel: branch, a stack in merge order, tidy, and buttons that ask Claude`, async ($, on) => {
    const { sent, clock } = engine(on, 36)
    await start($)
    await clock.settle()
    const ui = await $.ui.mount({ plugin: 'cockpit', surface, component: 'Pane', requestId: 'cockpit-git', props: PANE_PROPS })
    await clock.settle()
    const tree = await text(ui)

    for (const word of ['claude/feat', 'from main', '1 changed', '1 new', '#72 Signing', '#73 Eight servers', 'merged', 'Tidy up 1', 'merge the top one first']) {
      expect(tree).toContain(word)
    }
    await ui.press({ key: 'commit' })
    expect(sent[0]).toContain('uncommitted changes')
    await ui.press({ key: 'merge-72' })
    expect(sent[1]).toContain('PR #72')
    await ui.press({ key: 'tidy' })
    expect(sent[2]).toContain('old-pr')
  })

  test(`${surface} panel: an empty list says what to do`, async ($, on) => {
    const { clock } = engine(on, 36, { tasks: '- [x] all done\n' })
    await start($)
    await clock.settle()
    const ui = await panel($, surface)
    expect(await text(ui)).toContain('Nothing queued')
    expect(await ui.find({ key: 'continue' })).toBeUndefined()
    expect(await ui.find({ key: 'plan' })).toBeDefined()
  })
}
