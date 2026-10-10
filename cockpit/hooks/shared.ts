import type { Quick } from '../types'

// Everything the band and the panel both use: the values they draw, the project's files, the look.
// Nothing here takes the engine `$` (the validator only lets `$` go into functions of the same file),
// and the atoms are declared in each file that uses them (it must see them next to `read` and `update`).

// ponytail: assumes the 1h prompt-cache TTL this session runs on; the engine exposes cache_ttl only on model switch
export const TTL_MS = 60 * 60 * 1000
export const COMPACT_AT = 70
export const ROUTER_URL = 'http://127.0.0.1:20128/v1/models'
export const PANEL = 'cockpit'
export const PANEL_TITLE = 'Cockpit'
export const GIT_PANEL = 'cockpit-git'

export const DEFAULT_QUICK: [RegExp, Quick[]][] = [
  [
    /PUPSISPortal|IntPortal|intportal/,
    [
      { label: 'Rebuild', prompt: 'Rebuild the app and launch it so I can check the latest change.' },
      { label: 'Simulator', prompt: 'Build and run the app in the iOS Simulator and open the live panel.' },
      { label: 'Phone', prompt: 'Build and install the app on my real iPhone, following the phone notes in memory.' },
    ],
  ],
  [
    /Obsidian/,
    [
      { label: 'File → notes', prompt: "Run /file-to-notes on the newest PDF in this course's Resources that has no notes yet." },
      { label: 'Export PDF', prompt: 'Run /export-to-pdf on the note I edited most recently.' },
      { label: 'Assignment', prompt: "Run /assignment-notes on this course's newest assignment." },
    ],
  ],
]

// Worktrees share the main checkout's task list.
export const projectRoot = (root: string) => root.replace(/\/\.claude\/worktrees\/[^/]+$/, '')
export const nextFile = (root: string) => `${projectRoot(root)}/.claude/NEXT.md`

export const openTasks = (text: string): string[] =>
  text
    .split('\n')
    .filter(line => /^\s*- \[ \]/.test(line))
    .map(line => line.replace(/^\s*- \[ \]\s*/, ''))

export const firstOpen = (text: string) => openTasks(text)[0] ?? null

export const continueText = (task: string, file: string) =>
  `Continue with the next task: "${task}". When it is done, check it off in ${file} (- [x]) and add any follow-up tasks as "- [ ]" lines in order.`

export const planText = (file: string) =>
  `What's next? Read this project's plan, recent commits and open PRs, then write the next 3 concrete tasks as "- [ ]" lines at the top of ${file}. Don't start them.`

// ---- the look ----------------------------------------------------------------------------------

// Monokai on the dark theme, the same hues deepened enough to read on the light one.
export type Palette = {
  accent: string // Monokai green: brand, primary buttons, healthy
  warn: string
  hot: string
  info: string
  fg: string
  muted: string
  track: string // the empty part of a bar
  bg?: string // the panel's own ground; the light theme keeps the app's
}
const DARK: Palette = { accent: '#a6e22e', warn: '#e6db74', hot: '#f92672', info: '#66d9ef', fg: '#f8f8f2', muted: '#75715e', track: '#3e3d32', bg: '#272822' }
const LIGHT: Palette = { accent: '#4d7c0f', warn: '#8a6d00', hot: '#c2185b', info: '#0b7285', fg: '#272822', muted: '#75715e', track: '#e6e3dc' }
export const palette = (isLight: boolean): Palette => (isLight ? LIGHT : DARK)
export const isLightTheme = (rows: { key: string; value?: unknown }[]) =>
  String(rows.find(r => r.key === 'theme')?.value ?? 'dark').includes('light')

export type Tone = { color: 'accent' | 'warn' | 'hot'; glyph: string; label: string; frac: number }

// Tone names become the palette's colours here, so the logic never knows a hex.
export const tint = (c: Tone['color'] | undefined, p: Palette) => (c === undefined ? undefined : p[c])

// A pie glyph for the share of the cache's hour that is left.
export const pie = (frac: number) => (frac > 0.875 ? '●' : frac > 0.625 ? '◕' : frac > 0.375 ? '◑' : frac > 0.125 ? '◔' : '○')

export function cacheTone(v: { isWorking: boolean; left: number | null }): Tone {
  if (v.isWorking) return { color: 'accent', glyph: '✻', label: 'working', frac: 1 }
  if (v.left === null) return { color: 'hot', glyph: '○', label: 'cold', frac: 0 }
  if (v.left <= 0) return { color: 'hot', glyph: '○', label: 'expired', frac: 0 }
  return {
    color: v.left > 10 * 60_000 ? 'accent' : 'warn',
    glyph: pie(v.left / TTL_MS),
    label: `${Math.ceil(v.left / 60_000)}m`,
    frac: v.left / TTL_MS,
  }
}

// Plain until it matters.
export const heat = (pct?: number): Tone['color'] | undefined => (pct === undefined ? undefined : pct >= 85 ? 'hot' : pct >= 60 ? 'warn' : undefined)

// "2h 10m", "3d 4h", "40m": how long until a limit resets.
export function until(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60_000))
  if (m >= 2880) return `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`
  return `${m}m`
}

// The mark: a prompt in an 8x8 bitmap, drawn as square cells (rows from 6 down are the cursor line).
export const MARK = ['#.......', '.#......', '..#.....', '.#......', '#.......', '........', '....####', '........']
