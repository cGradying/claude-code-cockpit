import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import { orderPrs, parseLines, parsePrs, parseStatus, parseWorktrees, repoName, tidyPlan } from './gitparse'
import { GIT_PANEL, isLightTheme, palette } from './shared'
import type { Palette } from './shared'
import type { GitInfo } from '../types'

const tick = atom({ plugin: 'cockpit', key: 'tick' } as const, 0)
const git = atom({ plugin: 'cockpit', key: 'git' } as const, null)

const FRESH_MS = 60_000 // git state is re-read at most this often while the panel is drawn
const GH_FRESH_MS = 180_000 // gh asks the network, so less often

let inflight = false
let lastSent = { text: '', at: 0 }

async function sh($: EngineInterface, argv: string[], timeoutMs = 20_000): Promise<string | null> {
  try {
    const r = await $.process.run(argv, { timeoutMs })
    return r.exitCode === 0 ? r.stdout : null
  } catch {
    return null
  }
}

// Reads the repo the session is in. Never changes anything: every change goes through Claude, as a prompt.
async function refresh($: EngineInterface, withGh: boolean) {
  if (inflight) return
  inflight = true
  try {
    const now = await $.clock.now()
    const old = await read($, git)
    const status = await sh($, ['git', 'status', '--porcelain=v1', '-b'])
    if (status === null) {
      await update($, git, () => ({ ...(old ?? EMPTY), at: now, error: 'This folder is not a git repository.' }))
      return
    }
    const root = (await $.session.root()) ?? ''
    const base = ((await sh($, ['git', 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD'])) ?? 'origin/main').trim().replace(/^origin\//, '')
    const worktrees = parseWorktrees((await sh($, ['git', 'worktree', 'list', '--porcelain'])) ?? '')
    const merged = parseLines((await sh($, ['git', 'branch', '--merged', `origin/${base}`, '--format=%(refname:short)'])) ?? '')

    let prs = old?.prs ?? null
    let mergedHeads = old?.mergedHeads ?? []
    let ghAt = old?.ghAt ?? 0
    if (withGh) {
      const open = await sh($, ['gh', 'pr', 'list', '--author', '@me', '--state', 'open', '--limit', '40', '--json', 'number,title,headRefName,baseRefName,isDraft,statusCheckRollup'], 30_000)
      const done = await sh($, ['gh', 'pr', 'list', '--author', '@me', '--state', 'merged', '--limit', '40', '--json', 'headRefName'], 30_000)
      prs = open === null ? null : parsePrs(open)
      mergedHeads = done === null ? [] : (JSON.parse(done) as { headRefName: string }[]).map(r => r.headRefName)
      ghAt = now
    }
    await update($, git, () => ({ root, base, worktrees, merged, prs, mergedHeads, at: now, ghAt, error: null, ...parseStatus(status) }))
  } finally {
    inflight = false
  }
}

const EMPTY: GitInfo = {
  root: '', branch: '', base: 'main', ahead: 0, behind: 0, hasUpstream: false, staged: 0, changed: 0, untracked: 0,
  worktrees: [], merged: [], prs: null, mergedHeads: [], at: 0, ghAt: 0, error: null,
}

async function send($: EngineInterface, text: string) {
  const now = await $.clock.now()
  if (lastSent.text === text && now - lastSent.at < 10_000) return
  lastSent = { text, at: now }
  await $.prompt.submit({ text, asUser: true })
}

const PLAN = {
  commit: 'Look at my uncommitted changes (git status, git diff). Group them into logical commits with clear messages and commit them. Do not push.',
  push: 'Push the current branch to origin (set the upstream if there is none). Never force push.',
  pr: (base: string) => `Open a pull request from the current branch into ${base} with a clear title and a description of what changed and why. Check first that no PR is already open for it.`,
  sync: (base: string) => `Bring this branch up to date with ${base}. In an app-made worktree use the sync_with_base_branch tool; otherwise merge origin/${base} and resolve any conflicts. Tell me what conflicted.`,
  merge: (n: number, head: string, base: string) =>
    `Check that PR #${n} (${head} into ${base}) has green checks and no conflicts, then merge it the way this repo usually merges and delete its branch. If other open PRs are stacked on it, retarget them to ${base} afterwards.`,
  tidy: (worktrees: string[], branches: string[]) =>
    `Tidy up. These worktree branches and local branches are already merged: ${[...worktrees, ...branches].join(', ')}. For each, first confirm it has no unpushed or uncommitted work, then remove its worktree (use clean_up_worktrees) and delete the local branch. Do not touch anything not listed.`,
}

export function register(on: On) {
  on('ui.render', { component: 'Pane', requestId: GIT_PANEL }, async ($, e, nextHook) => {
    if (e.requestId !== GIT_PANEL) return nextHook(e)

    await read($, tick) // redraws every 30 seconds
    const g = await read($, git)
    const now = await $.clock.now()
    if (g === null || now - g.at > FRESH_MS || (g.ghAt === 0 && g.error === null) || now - g.ghAt > GH_FRESH_MS) {
      void refresh($, g === null || now - g.ghAt > GH_FRESH_MS)
    }

    const ui = $.ui.resolve(e)
    const { Box, Text, Button } = ui
    const pal: Palette = palette(isLightTheme(await $.config.list().catch(() => [])))

    const btn = (key: string, label: string, onPress: () => void, isMain = false) => (
      <Button key={key} plain onPress={onPress}>
        <Text bold={isMain} color={isMain ? pal.accent : undefined}>{`[ ${label} ]`}</Text>
      </Button>
    )
    const section = (title: string, children: unknown) => (
      <Box flexDirection="column">
        <Text bold color={pal.muted}>{title}</Text>
        {children}
      </Box>
    )

    const body = (() => {
      if (g === null) return <Text dimColor>Reading the repository…</Text>
      if (g.error) return <Text color={pal.hot}>{g.error}</Text>

      const dirty = g.staged + g.changed + g.untracked
      const ordered = g.prs ? orderPrs(g.prs) : []
      const hasPr = g.prs?.some(p => p.head === g.branch) ?? false
      const plan = tidyPlan(g)
      const tidyCount = plan.worktrees.length + plan.branches.length
      const mark = (c: string) => (c === 'pass' ? '✓ checks pass' : c === 'fail' ? '✗ checks fail' : c === 'pending' ? '… checks running' : 'no checks')
      const markColor = (c: string) => (c === 'pass' ? pal.accent : c === 'fail' ? pal.hot : c === 'pending' ? pal.warn : pal.muted)

      return (
        <Box flexDirection="column" gap={1}>
          {section(
            'Branch',
            <Box flexDirection="column">
              <Text>
                <Text bold color={pal.accent}>{g.branch}</Text>
                <Text dimColor>{` from ${g.base}`}</Text>
              </Text>
              <Text>
                <Text color={dirty === 0 ? pal.accent : pal.warn}>{dirty === 0 ? 'clean' : `${g.staged} staged · ${g.changed} changed · ${g.untracked} new`}</Text>
                <Text dimColor>{g.hasUpstream ? `  ↑${g.ahead} ↓${g.behind}` : '  not pushed yet'}</Text>
              </Text>
              <Box flexDirection="row" gap={2} flexWrap="wrap">
                {dirty > 0 && btn('commit', 'Commit', () => void send($, PLAN.commit), true)}
                {(g.ahead > 0 || !g.hasUpstream) && btn('push', 'Push', () => void send($, PLAN.push), dirty === 0)}
                {!hasPr && (g.ahead > 0 || g.hasUpstream) && g.branch !== g.base && btn('pr', 'Open PR', () => void send($, PLAN.pr(g.base)))}
                {g.behind > 0 && btn('sync', `Sync with ${g.base}`, () => void send($, PLAN.sync(g.base)), true)}
              </Box>
            </Box>,
          )}

          {section(
            g.prs === null ? 'Pull requests' : `Pull requests · ${g.prs.length}`,
            g.prs === null ? (
              <Text dimColor wrap="wrap">GitHub CLI (gh) is not signed in here, so open PRs are hidden.</Text>
            ) : ordered.length === 0 ? (
              <Text dimColor>No open pull requests.</Text>
            ) : (
              <Box flexDirection="column" gap={1}>
                {ordered.map(({ pr, depth }) => (
                  <Box key={`pr${pr.number}`} flexDirection="row" alignItems="center" gap={2}>
                    <Box flexGrow={1} flexShrink={1} flexDirection="column">
                      <Text wrap="truncate-end" bold={pr.head === g.branch}>{`${depth > 0 ? `${'  '.repeat(depth - 1)}└ ` : ''}#${pr.number} ${pr.title}`}</Text>
                      <Text wrap="truncate-end">
                        <Text dimColor>{`${pr.head} → ${pr.base}${pr.isDraft ? ' · draft' : ''} · `}</Text>
                        <Text color={markColor(pr.checks)}>{mark(pr.checks)}</Text>
                      </Text>
                    </Box>
                    {!pr.isDraft && pr.checks === 'pass' && btn(`merge-${pr.number}`, 'Merge', () => void send($, PLAN.merge(pr.number, pr.head, pr.base)), depth === 0)}
                  </Box>
                ))}
                {ordered.some(o => o.depth > 0) && <Text dimColor wrap="wrap">Stacked PRs: merge the top one first, then the ones under it.</Text>}
              </Box>
            ),
          )}

          {section(
            `Worktrees · ${g.worktrees.length}`,
            <Box flexDirection="column">
              {g.worktrees.slice(0, 8).map(w => {
                const landed = !w.isMain && w.branch !== null && plan.worktrees.some(p => p.path === w.path)
                return (
                  <Text key={w.path} wrap="truncate-end">
                    <Text color={landed ? pal.muted : undefined}>{w.branch ?? 'detached'}</Text>
                    {w.isMain && <Text dimColor> · main checkout</Text>}
                    {landed && <Text color={pal.accent}> · merged</Text>}
                  </Text>
                )
              })}
              {g.worktrees.length > 8 && <Text dimColor>{`+ ${g.worktrees.length - 8} more`}</Text>}
            </Box>,
          )}

          {section(
            'Tidy up',
            tidyCount === 0 ? (
              <Text dimColor>Nothing merged is left lying around.</Text>
            ) : (
              <Box flexDirection="column">
                <Text wrap="wrap">{`${plan.worktrees.length} merged worktrees and ${plan.branches.length} merged branches can go.`}</Text>
                <Box>{btn('tidy', `Tidy up ${tidyCount}`, () => void send($, PLAN.tidy(plan.worktrees.map(w => w.branch!), plan.branches)), true)}</Box>
              </Box>
            ),
          )}
        </Box>
      )
    })()

    return (
      <Box flexDirection="column" paddingX={2} paddingY={1} gap={1} flexGrow={1} backgroundColor={pal.bg}>
        <Box flexDirection="row" alignItems="center" gap={2}>
          <Box flexGrow={1}>
            <Text>
              <Text bold color={pal.accent}>git </Text>
              <Text dimColor>{g ? repoName(g.root) : ''}</Text>
            </Text>
          </Box>
          {btn('refresh', 'Refresh', () => void refresh($, true))}
        </Box>
        {body}
        <Text dimColor wrap="wrap">Buttons ask Claude to do the change, so you see every command. This panel only reads.</Text>
      </Box>
    )
  })
}
