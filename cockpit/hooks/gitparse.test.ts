import { expect, test } from 'claude-code/testing'

import { orderPrs, parsePrs, parseStatus, parseWorktrees, tidyPlan } from './gitparse'

test('status: branch, upstream, ahead and behind, and the three kinds of change', () => {
  const s = parseStatus('## claude/feat...origin/claude/feat [ahead 2, behind 1]\nM  a.ts\n M b.ts\nMM c.ts\n?? d.ts\n')
  expect(s).toEqual({ branch: 'claude/feat', hasUpstream: true, ahead: 2, behind: 1, staged: 2, changed: 2, untracked: 1 })
  expect(parseStatus('## main\n').hasUpstream).toBe(false)
})

test('worktrees: the first is the main checkout', () => {
  const w = parseWorktrees('worktree /r\nHEAD abc\nbranch refs/heads/main\n\nworktree /r/.claude/worktrees/x\nHEAD def\nbranch refs/heads/claude/x\n\nworktree /r/y\nHEAD 123\ndetached\n')
  expect(w.map(x => [x.branch, x.isMain])).toEqual([['main', true], ['claude/x', false], [null, false]])
})

const pr = (number: number, head: string, base: string, checks = 'SUCCESS') =>
  ({ number, title: `t${number}`, headRefName: head, baseRefName: base, isDraft: false, statusCheckRollup: [{ status: 'COMPLETED', conclusion: checks }] })

test('prs: checks roll up and a stack is ordered bottom first, children indented', () => {
  const prs = parsePrs(JSON.stringify([pr(73, 'b', 'a'), pr(72, 'a', 'main'), pr(80, 'z', 'main', 'FAILURE')]))
  expect(prs.map(p => p.checks)).toEqual(['pass', 'pass', 'fail'])
  expect(orderPrs(prs).map(o => [o.pr.number, o.depth])).toEqual([[72, 0], [73, 1], [80, 0]])
})

test('tidy: only merged work, never the current branch, the base or the main checkout', () => {
  const plan = tidyPlan({
    branch: 'cur',
    base: 'main',
    worktrees: [
      { path: '/r', branch: 'main', isMain: true },
      { path: '/w1', branch: 'done', isMain: false },
      { path: '/w2', branch: 'cur', isMain: false },
      { path: '/w3', branch: 'wip', isMain: false },
    ],
    merged: ['main', 'cur', 'old', 'done'],
    mergedHeads: ['done'],
  })
  expect(plan.worktrees.map(w => w.branch)).toEqual(['done'])
  expect(plan.branches).toEqual(['old'])
})
