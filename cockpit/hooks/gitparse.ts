import type { GitInfo, Pr, Worktree } from '../types'

// Pure readers of what git and gh print, so they can be tested without a repository.

export function parseStatus(text: string) {
  const lines = text.split('\n').filter(Boolean)
  const head = lines[0]?.startsWith('## ') ? lines[0].slice(3) : ''
  const branch = head.split('...')[0]!.replace(/^No commits yet on /, '').replace(/^HEAD \(no branch\)/, 'detached HEAD')
  const hasUpstream = head.includes('...')
  const ahead = Number(/ahead (\d+)/.exec(head)?.[1] ?? 0)
  const behind = Number(/behind (\d+)/.exec(head)?.[1] ?? 0)
  let staged = 0
  let changed = 0
  let untracked = 0
  for (const l of lines.slice(1)) {
    if (l.startsWith('??')) untracked++
    else {
      if (l[0] !== ' ') staged++
      if (l[1] !== ' ') changed++
    }
  }
  return { branch, hasUpstream, ahead, behind, staged, changed, untracked }
}

export function parseWorktrees(text: string): Worktree[] {
  return text
    .split('\n\n')
    .map(b => b.trim())
    .filter(Boolean)
    .map((b, i) => ({
      path: /^worktree (.+)$/m.exec(b)?.[1] ?? '',
      branch: /^branch refs\/heads\/(.+)$/m.exec(b)?.[1] ?? null,
      isMain: i === 0,
    }))
}

export const parseLines = (text: string) => text.split('\n').map(l => l.trim()).filter(Boolean)

type Check = { conclusion?: string | null; status?: string | null; state?: string | null }
function rollup(checks: Check[] | undefined): Pr['checks'] {
  if (!checks || checks.length === 0) return 'none'
  const bad = ['FAILURE', 'ERROR', 'TIMED_OUT', 'CANCELLED', 'ACTION_REQUIRED']
  if (checks.some(c => bad.includes(c.conclusion ?? '') || bad.includes(c.state ?? ''))) return 'fail'
  if (checks.some(c => (c.status && c.status !== 'COMPLETED') || c.state === 'PENDING' || c.state === 'EXPECTED')) return 'pending'
  return 'pass'
}

export function parsePrs(json: string): Pr[] {
  const rows = JSON.parse(json) as {
    number: number
    title: string
    headRefName: string
    baseRefName: string
    isDraft: boolean
    statusCheckRollup?: Check[]
  }[]
  return rows.map(r => ({
    number: r.number,
    title: r.title,
    head: r.headRefName,
    base: r.baseRefName,
    isDraft: r.isDraft,
    checks: rollup(r.statusCheckRollup),
  }))
}

// Stacks first-to-merge on top: a PR whose base is another open PR's head sits under that PR, indented.
export function orderPrs(prs: Pr[]): { pr: Pr; depth: number }[] {
  const heads = new Set(prs.map(p => p.head))
  const out: { pr: Pr; depth: number }[] = []
  const place = (pr: Pr, depth: number, seen: Set<number>) => {
    if (seen.has(pr.number)) return
    seen.add(pr.number)
    out.push({ pr, depth })
    for (const child of prs.filter(c => c.base === pr.head)) place(child, depth + 1, seen)
  }
  const seen = new Set<number>()
  for (const pr of prs.filter(p => !heads.has(p.base))) place(pr, 0, seen)
  for (const pr of prs) place(pr, 0, seen) // anything in a cycle
  return out
}

// What is safe to remove: other worktrees and local branches whose work already landed on the base.
export function tidyPlan(g: Pick<GitInfo, 'branch' | 'base' | 'worktrees' | 'merged' | 'mergedHeads'>) {
  const landed = new Set([...g.merged, ...g.mergedHeads])
  const keep = new Set([g.branch, g.base, 'main', 'master', 'develop'])
  const worktrees = g.worktrees.filter(w => !w.isMain && w.branch && !keep.has(w.branch) && landed.has(w.branch))
  const inWorktree = new Set(worktrees.map(w => w.branch))
  const branches = g.merged.filter(b => !keep.has(b) && !inWorktree.has(b))
  return { worktrees, branches }
}

export const repoName = (root: string) => root.replace(/\/\.claude\/worktrees\/[^/]+$/, '').split('/').pop() ?? root
