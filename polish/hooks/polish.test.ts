import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { acceptable, applyFixes, jargon, learn, looksDictated, systemPrompt, unwrap, vocabulary } from './text'

const ok = (value: unknown) => ({ value }) as never

const DICTATION = 'um so like fix the the filetree thing you know and then uh open the the PR for IntPortal'
const CLEAN = 'Fix the filetree thing, then open the PR for IntPortal.'

// ---- the pure part ----------------------------------------------------------------------------------

test('dictation is told from typing by fillers, stutters, spoken punctuation and run-ons', () => {
  expect(looksDictated(DICTATION)).toBe(true)
  expect(looksDictated('Fix the build, then open a PR.')).toBe(false)
  expect(looksDictated('add a button comma make it green new line and test it')).toBe(true)
  expect(looksDictated('Please add a button and make it green')).toBe(false)
})

test('jargon: camelCase, ALLCAPS, letters with digits, snake_case, mid-sentence capitals; not plain words', () => {
  const found = jargon('use SIS8 and 9router with ragentFoo in the build_step, then ask Tauri. And the end.')
  for (const t of ['SIS8', '9router', 'ragentFoo', 'build_step', 'Tauri']) expect(found).toContain(t)
  expect(found).not.toContain('And')
  expect(found).not.toContain('the')
})

test('a learned term joins the vocabulary on its third sighting; the seed and your own terms always do', () => {
  let v = {}
  for (let i = 0; i < 2; i++) v = learn(v, 'ship Zorbex today')
  expect(vocabulary([], v)).not.toContain('Zorbex')
  v = learn(v, 'ship Zorbex today')
  expect(vocabulary([], v)).toContain('Zorbex')
  expect(vocabulary(['Mine'], {})).toEqual(expect.arrayContaining(['Mine', 'IntPortal']))
})

test('taught mishearings are replaced as whole phrases, any case', () => {
  expect(applyFixes('open Pupsis Portal now', { 'pupsis portal': 'PUPSISPortal' })).toBe('open PUPSISPortal now')
  expect(applyFixes('a pupsis portals thing', { 'pupsis portal': 'PUPSISPortal' })).toBe('a pupsis portals thing')
})

test('a cleanup that lost the plot is refused', () => {
  const said = 'open pr 42 and then change 7 files in https://example.com/a'
  expect(acceptable(said, 'Open PR 42, then change 7 files in https://example.com/a.')).toBe(true)
  expect(acceptable(said, 'Open the PR.')).toBe(false) // lost 42, 7 and the link
  expect(acceptable(said, "I can't help with that.")).toBe(false)
  expect(acceptable(said, '')).toBe(false)
  expect(unwrap('```\n"Hello there"\n```')).toBe('Hello there')
  expect(systemPrompt(['IntPortal'], { 'pupsis portal': 'PUPSISPortal' })).toContain('"pupsis portal" means "PUPSISPortal"')
})

// ---- the hook ---------------------------------------------------------------------------------------------

function world(on: On, reply = CLEAN) {
  mock.clock(on, { now: Date.parse('2026-10-11T12:00:00Z') })
  mock.store(on, {})
  const asked: { system: string; prompt: string; model: string }[] = []
  const entered: { text: string; context?: readonly string[] }[] = []
  const toasts: string[] = []
  const filled: string[] = []
  on('model.complete', async (_, e) => {
    asked.push({ system: e.system as string, prompt: e.prompt as string, model: e.model as string })
    return ok({ isAnswered: true, text: reply, usage: {} })
  })
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  on('command.register', async (_, e) => ok({ command: e.name }))
  on('ui.toast', async (_, e) => {
    toasts.push(String((e as unknown as { text: string }).text))
    return ok(undefined)
  })
  on('ui.status', async () => ok(undefined))
  on('prompt.fill', async (_, e) => {
    filled.push(e.text)
    return { isFilled: true } as never
  })
  on('prompt.submit', async (_, e) => {
    entered.push({ text: e.text, context: e.context })
    return { text: e.text, context: e.context }
  })
  return { asked, entered, toasts, filled }
}

const start = ($: Engine) => $.session.start({ source: 'startup', cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
const type = ($: Engine, text: string) => $.prompt.submit({ text, origin: { kind: 'composer' }, wait: false } as never)

test('a dictated prompt is cleaned by Haiku and sent, with the raw words as a hidden note', async ($, on) => {
  const w = world(on)
  await start($)
  await type($, DICTATION)
  expect(w.asked).toHaveLength(1)
  expect(w.asked[0]!.model).toBe('haiku')
  expect(w.asked[0]!.system).toContain('IntPortal')
  expect(w.entered[0]!.text).toBe(CLEAN)
  expect(w.entered[0]!.context?.join('\n')).toContain(DICTATION)
  expect(w.toasts.join(' ')).toContain('polish:')
})

test('a prompt typed cleanly costs nothing: no model call, text untouched', async ($, on) => {
  const w = world(on)
  await start($)
  await type($, 'Fix the build, then open a PR for the cockpit repo.')
  expect(w.asked).toHaveLength(0)
  expect(w.entered[0]!.text).toBe('Fix the build, then open a PR for the cockpit repo.')
})

test('what the plugin or the person must not have cleaned is left alone: commands, plugin prompts, secrets, off', async ($, on) => {
  const w = world(on)
  await start($)
  await type($, '/model um like switch it you know')
  await $.prompt.submit({ text: DICTATION, asUser: true } as never) // a plugin's own prompt
  await type($, `um so like use sk-TESTKEY000000000000-notreal-123456 you know and uh run it`)
  await $.command.run({ command: 'polish', args: 'off' } as never)
  await type($, DICTATION)
  expect(w.asked).toHaveLength(0)
})

test('a bad answer falls back to your own words', async ($, on) => {
  const w = world(on, "I'm sorry, I can't help with that.")
  await start($)
  await type($, DICTATION)
  expect(w.asked).toHaveLength(1)
  expect(w.entered[0]!.text).toBe(DICTATION)
})

test('review mode puts the cleaned text back in the box and sends it on Enter, without a second model call', async ($, on) => {
  const w = world(on)
  await start($)
  await $.command.run({ command: 'polish', args: 'review' } as never)
  const held = await type($, DICTATION)
  expect(JSON.stringify(held)).toContain('Enter sends it')
  expect(w.filled).toEqual([CLEAN])
  expect(w.entered).toHaveLength(0)
  await type($, CLEAN)
  expect(w.entered[0]!.text).toBe(CLEAN)
  expect(w.asked).toHaveLength(1)
})

test('always cleans typed prompts too; add and say teach it, last and test show it', async ($, on) => {
  const w = world(on)
  await start($)
  await $.command.run({ command: 'polish', args: 'always' } as never)
  await $.command.run({ command: 'polish', args: 'add Zorbex' } as never)
  await $.command.run({ command: 'polish', args: 'say pupsis portal = PUPSISPortal' } as never)
  await type($, 'Please open the pupsis portal repo and check Zorbex.')
  expect(w.asked[0]!.system).toContain('Zorbex')
  expect(w.asked[0]!.system).toContain('"pupsis portal" means "PUPSISPortal"')
  expect(w.asked[0]!.prompt).toContain('PUPSISPortal repo')
  const last = JSON.stringify(await $.command.run({ command: 'polish', args: 'last' } as never))
  expect(last).toContain('you said')
  const tried = JSON.stringify(await $.command.run({ command: 'polish', args: 'test um fix the the thing you know for me' } as never))
  expect(tried).toContain(CLEAN)
})
