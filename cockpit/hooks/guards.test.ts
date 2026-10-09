import { expect, test } from 'claude-code/testing'

test('denies a commit that credits Claude', async ($, on) => {
  on('tool.call', () => ({ result: { stdout: 'ran' } as never }))
  const ran = await $.tool.call({
    tool: 'Bash',
    command: 'git commit -m "x\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"',
  })
  expect(ran.deny).toContain('never wants Claude credited')
})

test('denies a PR body with the Claude Code footer', async ($, on) => {
  on('tool.call', () => ({ result: { stdout: 'ran' } as never }))
  const ran = await $.tool.call({
    tool: 'Bash',
    command: 'gh pr create --body "🤖 Generated with [Claude Code](https://claude.com/claude-code)"',
  })
  expect(ran.deny).toBeDefined()
})

test('lets a plain commit through', async ($, on) => {
  on('tool.call', () => ({ result: { stdout: 'ran' } as never }))
  const ran = await $.tool.call({ tool: 'Bash', command: 'git commit -m "fix: thing"' })
  expect(ran.deny).toBeUndefined()
})

test('holds back a pasted key once, then sends on the second Enter', async ($, on) => {
  const entered: string[] = []
  const refilled: string[] = []
  on('prompt.fill', (_, e) => {
    refilled.push(e.text)
    return { isFilled: true } as never
  })
  on('prompt.submit', (_, e) => {
    entered.push(e.text)
    return { text: e.text }
  })
  const text = 'set it up, key sk-TESTKEY000000000000-notreal-123456'
  const first = await $.prompt.submit({ text })
  expect(first.drop).toContain('sk- API key')
  expect(entered).toHaveLength(0)
  expect(refilled).toEqual([text])
  await $.prompt.submit({ text })
  expect(entered).toEqual([text])
})

test('adds the impeccable nudge to a UI prompt only', async ($, on) => {
  const contexts: (readonly string[] | undefined)[] = []
  on('prompt.submit', (_, e) => {
    contexts.push(e.context)
    return { text: e.text }
  })
  await $.prompt.submit({ text: 'redesign the settings layout' })
  await $.prompt.submit({ text: 'fix the parser crash' })
  await $.prompt.submit({ text: 'use /impeccable on the theme' })
  expect(contexts[0]?.join(' ')).toContain('impeccable')
  expect(contexts[1]).toBeUndefined()
  expect(contexts[2]).toBeUndefined()
})
