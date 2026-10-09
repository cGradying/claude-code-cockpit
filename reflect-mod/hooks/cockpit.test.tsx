// cockpit patch tests: reflect starts paused, so no model call happens until the user resumes it.
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const VOID = { value: undefined } as never
const ok = (value: unknown) => ({ value }) as never

function world(on: On) {
  const clock = mock.clock(on, { now: Date.parse('2026-10-02T12:00:00Z') })
  mock.store(on, {})
  mock.env(on, { HOME: '/home/u' })
  const files: Record<string, string> = {}
  const asked: string[] = []
  on('model.complete', async () => {
    asked.push('call')
    return ok({ isAnswered: true, text: JSON.stringify({ is_rule: false, rule: '', scope: 'global', confidence: 0.9 }), usage: {} })
  })
  on('session.messages', async () => ok([{ role: 'assistant', text: 'I used npm.', toolUses: [] }]))
  on('session.root', async () => ok('/repo'))
  on('fs.exists', async ($, e) => ok(e.path in files))
  on('fs.read', async ($, e) => ok(files[e.path] ?? ''))
  on('fs.write', async ($, e) => {
    files[e.path] = e.text
    return VOID
  })
  on('prompt.read', async () => ok({ text: '', cursor: 0 }))
  on('prompt.fill', async () => ({ isFilled: true }) as never)
  on('command.register', async ($, e) => ok({ command: e.name }))
  on('ui.toast', async () => VOID)
  on('ui.render', async () => ({ type: 'Box', props: {}, children: [] }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  on('prompt.submit', async ($, e) => ({ text: e.text }))
  on('prompt.compose', async () => ({ sections: [] }))
  return { clock, files, asked }
}

const start = ($: Engine) => $.session.start({ source: 'startup', cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
async function say($: Engine, w: { clock: { settle: () => Promise<void> } }, text: string) {
  await $.prompt.submit({ text, origin: { kind: 'composer' }, wait: false } as never)
  await w.clock.settle()
}

test('starts paused: a correction is not sent to the model', async ($, on) => {
  const w = world(on)
  await start($)
  await say($, w, 'no, use pnpm not npm')
  expect(w.asked).toHaveLength(0)
})

test('resuming with /reflect-pause turns the model check on, pausing again turns it off', async ($, on) => {
  const w = world(on)
  await start($)
  const resumed = await $.command.run({ command: 'reflect-pause', args: '' } as never)
  expect(JSON.stringify(resumed)).toContain('On.')
  await say($, w, 'no, use pnpm not npm')
  expect(w.asked).toHaveLength(1)
  const paused = await $.command.run({ command: 'reflect-pause', args: '' } as never)
  expect(JSON.stringify(paused)).toContain('Paused.')
  await say($, w, 'no, use bun not npm')
  expect(w.asked).toHaveLength(1)
})

test('an explicit "remember:" needs no model and still works while paused', async ($, on) => {
  const w = world(on)
  await start($)
  await say($, w, 'remember: never commit with a Claude co-author line')
  expect(w.asked).toHaveLength(0)
})
