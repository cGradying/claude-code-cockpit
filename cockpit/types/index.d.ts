export type NextTask = string | null
export type Quick = { label: string; prompt: string }

export type Worktree = { path: string; branch: string | null; isMain: boolean }
export type Pr = {
  number: number
  title: string
  head: string
  base: string
  isDraft: boolean
  checks: 'pass' | 'fail' | 'pending' | 'none'
}
export type GitInfo = {
  root: string
  branch: string
  base: string
  ahead: number
  behind: number
  hasUpstream: boolean
  staged: number
  changed: number
  untracked: number
  worktrees: Worktree[]
  merged: string[] // local branches already merged into the base
  prs: Pr[] | null // null: gh is missing or not signed in
  mergedHeads: string[] // heads of my recently merged PRs
  at: number
  ghAt: number
  error: string | null
}

declare module 'claude-code' {
  interface PluginState {
    'cockpit': {
      lastAt: number | null
      tick: number
      next: NextTask
      tasks: string[]
      router: boolean | null
      quick: Quick[]
      git: GitInfo | null
    }
  }
}
