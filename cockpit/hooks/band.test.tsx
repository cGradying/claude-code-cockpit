import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

const ROOT = '/work/IntPortal/.claude/worktrees/some-branch'
const NEXT = '/work/IntPortal/.claude/NEXT.md'
const PROPS = { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 120 } as never

function engine(on: On, pct: number) {
  const sent: string[] = []
  const commands: string[] = []
  const clock = mock.clock(on, { now: 1_000_000 } as never)
  on('session.root', () => ({ value: ROOT }))
  // another plugin's band, drawn beneath ours
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['below-plugin'] }) as never)
  on('session.usage', () => ({ value: {
    startedAt: 0,
    context: { tokens: 72_500, window: 200_000, percent: pct },
    rateLimits: [{ kind: 'five_hour', percentUsed: 10 }, { kind: 'seven_day', percentUsed: 59 }],
    cost: { usd: 0.21 },
  } }) as never)
  on('fs.exists', (_, e) => ({ value: JSON.stringify(e).includes(NEXT) }))
  on('fs.read', () => ({ value: '- [x] F1 tokens\n- [ ] Write PLAN-2.md\n- [ ] Later thing\n' }))
  on('http.fetch', () => ({ value: { status: 200, ok: true, headers: {}, text: '{}' } }))
  on('command.register', (_, e) => ({ value: { command: e.name } }) as never)
  on('command.run', (_, e) => {
    commands.push(`${e.command} ${e.args}`)
    return { text: '' }
  })
  on('prompt.submit', (_, e) => {
    sent.push(e.text)
    return { text: e.text }
  })
  on('prompt.suggest', () => ({ isShown: true }) as never)
  return { sent, commands, clock }
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}: shows the next task and Continue sends it`, async ($, on) => {
    const { sent, clock } = engine(on, 30)
    await $.session.start({ cwd: ROOT, source: 'startup' } as never).catch(() => undefined)
    await clock.settle()
    const ui = await $.ui.mount({ plugin: 'cockpit', surface, component: 'AbovePrompt', props: PROPS })

    expect(await ui.find({ key: 'continue' })).toBeDefined()
    expect(await ui.find({ key: 'compact' })).toBeUndefined()
    expect(JSON.stringify(await ui.drawn())).toContain('below-plugin')
    expect(JSON.stringify(await ui.drawn())).toContain('9router')
    expect(JSON.stringify(await ui.drawn())).toContain('Write PLAN-2.md')
    // terminal: continue, plan, 3 shortcuts; desktop: continue, plan, More (shortcuts swap in behind it)
    expect(await ui.findAll({ type: 'Button' })).toHaveLength(surface === 'terminal' ? 5 : 3)

    await ui.press({ key: 'continue' })
    await ui.press({ key: 'continue' })
    expect(sent).toHaveLength(1)
    expect(sent[0]).toContain('Write PLAN-2.md')
    expect(sent[0]).toContain(NEXT)

    if (surface === 'desktop') {
      await ui.press({ key: 'more' })
      expect(await ui.find({ key: 'continue' })).toBeUndefined()
      expect(await ui.find({ key: 'back' })).toBeDefined()
    }
    await ui.press({ key: 'quick-1' })
    expect(sent[1]).toContain('iOS Simulator')
  })

  test(`${surface}: a quiet minute redraws without a new SVG`, async ($, on) => {
    const { clock } = engine(on, 30)
    await $.session.start({ cwd: ROOT, source: 'startup', seconds_since_last_response: 60 } as never).catch(() => undefined)
    await clock.settle()
    const ui = await $.ui.mount({ plugin: 'cockpit', surface, component: 'AbovePrompt', props: PROPS })
    const source = async () => JSON.stringify(await ui.findAll({ type: 'Svg' }))
    const before = await source()
    await clock.advance(61_000)
    await ui.redraw()
    const after = await source()
    expect(after).toBe(before)
    expect(JSON.stringify(await ui.drawn())).not.toContain('<title>')
  })

  test(`${surface}: the card keeps its size when a turn starts`, async ($, on) => {
    if (surface === 'terminal') return
    const { clock } = engine(on, 30)
    await $.session.start({ cwd: ROOT, source: 'startup' } as never).catch(() => undefined)
    await clock.settle()
    const ui = await $.ui.mount({ plugin: 'cockpit', surface, component: 'AbovePrompt', props: PROPS })
    const widths = async () => {
      const tree = JSON.stringify(await ui.drawn())
      return [...tree.matchAll(/"width":(\d+)/g)].map(m => m[1]).join(',')
    }
    const idle = await widths()
    expect(idle.split(",").length).toBeGreaterThan(2)
    await ui.redraw({ ...(PROPS as object), isWorking: true } as never)
    expect(await widths()).toBe(idle)
  })

  test(`${surface}: offers Compact past 70% and keeps the plan`, async ($, on) => {
    const { commands, clock } = engine(on, 82)
    await $.session.start({ cwd: ROOT, source: 'startup' } as never).catch(() => undefined)
    const ui = await $.ui.mount({ plugin: 'cockpit', surface, component: 'AbovePrompt', props: PROPS })

    await ui.press({ key: 'compact' })
    expect(commands).toHaveLength(0) // started from a timer, not inside the press
    await clock.advance(10)
    expect(commands[0]).toContain('compact Keep the current plan')
  })
}
