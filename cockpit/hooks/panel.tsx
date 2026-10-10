import { atom, read } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import {
  COMPACT_AT,
  MARK,
  PANEL,
  TTL_MS,
  cacheTone,
  continueText,
  heat,
  isLightTheme,
  nextFile,
  palette,
  planText,
  tint,
  until,
} from './shared'
import type { Palette, Tone } from './shared'

// The same values the band keeps (same plugin and key, so the same state).
const lastAt = atom({ plugin: 'cockpit', key: 'lastAt' } as const, null)
const tick = atom({ plugin: 'cockpit', key: 'tick' } as const, 0)
const tasks = atom({ plugin: 'cockpit', key: 'tasks' } as const, [])
// null: 9router never answered this session, so it stays hidden
const router = atom({ plugin: 'cockpit', key: 'router' } as const, null)
const quick = atom({ plugin: 'cockpit', key: 'quick' } as const, [])

// A press queues a prompt, so a double click would send it twice.
let lastSent = { text: '', at: 0 }

async function send($: EngineInterface, text: string) {
  const now = await $.clock.now()
  if (lastSent.text === text && now - lastSent.at < 10_000) return
  lastSent = { text, at: now }
  await $.prompt.submit({ text, asUser: true })
}

// A press's own work is dropped when the press ends, so /compact starts from a timer.
function compactNow($: EngineInterface, file: string) {
  void $.clock.after(1, () =>
    $.command
      .run({
        command: 'compact',
        args: `Keep the current plan, the open tasks in ${file}, open PRs, decisions made and unresolved bugs.`,
      })
      .catch((error: unknown) => $.ui.toast(`Compacting failed: ${error instanceof Error ? error.message : String(error)}`)),
  )
}

// "1M", "200k": the context window as people say it.
const windowLabel = (n: number) => (n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(1)}M` : `${Math.round(n / 1000)}k`)

// A mod's command, started from a timer so releasing the press does not cancel it.
function runMod($: EngineInterface, command: string, args?: string) {
  void $.clock.after(1, () =>
    $.command
      .run(args === undefined ? { command } : { command, args })
      .catch((error: unknown) => $.ui.toast(`/${command} failed: ${error instanceof Error ? error.message : String(error)}`)),
  )
}

// The mods this plugin bundles, each with the presses that drive it. Their state lives in their own
// plugins and cannot be read from here, so a button names the action it does, never a state.
const MODS: { name: string; note: string; actions: { label: string; command: string; args?: string }[] }[] = [
  { name: 'Agents & progress', note: 'subagents, cost, flow progress', actions: [{ label: 'Open', command: 'agents-info' }] },
  { name: 'File tree', note: 'sidebar with git status', actions: [{ label: 'Open', command: 'filetree' }] },
  { name: 'Replay', note: 'step through the last edits', actions: [{ label: 'Open', command: 'replay' }] },
  {
    name: 'Skin',
    note: 'transcript restyle',
    actions: [
      { label: 'Noir', command: 'skin', args: 'noir' },
      { label: 'Off', command: 'skin', args: 'off' },
    ],
  },
  {
    name: 'Polish',
    note: 'clean dictated prompts (Haiku)',
    actions: [
      { label: 'Auto', command: 'polish', args: 'auto' },
      { label: 'Always', command: 'polish', args: 'always' },
      { label: 'Off', command: 'polish', args: 'off' },
    ],
  },
  { name: 'Reflect', note: 'catch corrections (uses Haiku)', actions: [{ label: 'On / off', command: 'reflect-pause' }] },
  {
    name: 'Keep-warm',
    note: 'spends tokens every ~50 min',
    actions: [
      { label: 'Arm', command: 'keepwarm' },
      { label: 'Stop', command: 'keepwarm', args: 'off' },
    ],
  },
]

// The mark and the name, all square: a prompt in pixel cells and a block cursor, drawn from the palette.
// Drawn as an image, so it needs the namespace; the surface's own text falls back where it has no Svg.
const headerSvg = (p: Palette) => {
  const cells = MARK.flatMap((row, y) =>
    [...row].map((c, x) => (c === '#' ? `<rect x="${x * 4 + 6}" y="${y * 4 + 6}" width="4" height="4" fill="${y >= 6 ? p.info : p.accent}"/>` : '')),
  ).join('')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="52" viewBox="0 0 300 52" shape-rendering="crispEdges">` +
    `<rect x="1" y="1" width="42" height="42" fill="${p.bg ?? '#f6f4ee'}" stroke="${p.accent}" stroke-width="2"/>` +
    cells +
    `<text x="58" y="26" font-family="SF Mono, Menlo, ui-monospace, monospace" font-size="22" font-weight="700" letter-spacing="1" fill="${p.fg}">cockpit</text>` +
    `<rect x="164" y="9" width="12" height="19" fill="${p.accent}"/>` +
    `<text x="58" y="41" font-family="SF Mono, Menlo, ui-monospace, monospace" font-size="11" fill="${p.muted}">cache, context, limits, mods</text>` +
    `</svg>`
  )
}

const LIMIT_NAMES: Record<string, string> = { five_hour: '5-hour limit', seven_day: 'Weekly limit' }

// The roomy view: everything the band leaves out, in one place beside the conversation.
export function register(on: On) {
  on('ui.render', { component: 'Pane', requestId: PANEL }, async ($, e, nextHook) => {
    if (e.requestId !== PANEL) return nextHook(e)

    await read($, tick) // redraws every 30 seconds
    const at = await read($, lastAt)
    const list = await read($, tasks)
    const shortcuts = await read($, quick)
    const isUp = await read($, router)
    const usage = await $.session.usage()
    const now = await $.clock.now()
    const file = nextFile(await $.session.root())
    const ui = $.ui.resolve(e)
    const { Box, Text, Button } = ui
    const pal = palette(isLightTheme(await $.config.list().catch(() => [])))

    const left = at === null ? null : TTL_MS - (now - at)
    const cache = cacheTone({ isWorking: false, left })
    const ctxPct = usage.context.percent

    // One labelled block; the title is dim and small so the numbers lead.
    const section = (title: string, children: unknown) => (
      <Box flexDirection="column">
        <Text bold color={pal.muted}>{title}</Text>
        {children}
      </Box>
    )
    // A solid bar: a track and a filled part sized in percent, so it is always exactly as wide as the
    // panel and can never wrap or show seams the way a row of block characters does.
    // A control drawn as text, `[ Open ]`, so nothing about it is rounded. The label stays its name.
    const btn = (key: string, label: string, onPress: () => void, o: { hotkey?: string; isMain?: boolean } = {}) => (
      <Button key={key} plain hotkey={o.hotkey} onPress={onPress}>
        <Text bold={o.isMain} color={o.isMain ? pal.accent : undefined}>{`[ ${label} ]`}</Text>
      </Button>
    )
    const meter = (pct: number, tone?: Tone['color']) => (
      <Box width="100%" height={1} backgroundColor={pal.track}>
        <Box width={`${Math.max(0, Math.min(100, Math.round(pct)))}%`} height={1} backgroundColor={tint(tone, pal) ?? pal.accent} />
      </Box>
    )

    return (
      <Box flexDirection="column" paddingX={2} paddingY={1} gap={1} flexGrow={1} backgroundColor={pal.bg}>
        {'Svg' in ui ? (
          <ui.Svg source={headerSvg(pal)} alt="cockpit" width={300} height={52} />
        ) : (
          <Text bold color={pal.accent}>cockpit</Text>
        )}

        {section(
          'Prompt cache',
          <Box flexDirection="column">
            <Text>
              <Text bold color={tint(cache.color, pal)}>
                {`${cache.glyph} ${cache.label === 'expired' || cache.label === 'cold' ? cache.label : `${cache.label} left`}`}
              </Text>
              <Text dimColor>{` of ${TTL_MS / 3_600_000} hour`}</Text>
            </Text>
            {meter(cache.frac * 100, cache.color)}
            <Text dimColor wrap="wrap">
              {left !== null && left > 0 ? 'Refreshes after every answer.' : 'The next message re-writes the context at full price.'}
            </Text>
          </Box>,
        )}

        {section(
          'Context',
          <Box flexDirection="column">
            <Text>
              <Text bold>{usage.context.tokens === undefined ? 'no reading yet' : `${(usage.context.tokens / 1000).toFixed(1)}k tokens`}</Text>
              {ctxPct !== undefined && <Text color={tint(heat(ctxPct), pal)}>{` · ${ctxPct}%`}</Text>}
              <Text dimColor>{` of ${windowLabel(usage.context.window)}`}</Text>
            </Text>
            {ctxPct !== undefined && meter(ctxPct, heat(ctxPct))}
            <Box>
              {btn('compact', 'Compact', () => compactNow($, file), { hotkey: 'k', isMain: (ctxPct ?? 0) >= COMPACT_AT })}
            </Box>
          </Box>,
        )}

        {usage.rateLimits.length > 0 &&
          section(
            'Plan limits',
            <Box flexDirection="column" gap={1}>
              {usage.rateLimits.map(r => {
                const reset = r.resetsAt ? Date.parse(r.resetsAt) - now : NaN
                return (
                  <Box key={r.kind} flexDirection="column">
                    <Text>
                      <Text>{LIMIT_NAMES[r.kind] ?? r.kind}</Text>
                      <Text bold color={tint(heat(r.percentUsed), pal)}>{` ${Math.round(r.percentUsed)}%`}</Text>
                      {Number.isFinite(reset) && <Text dimColor>{` · resets in ${until(reset)}`}</Text>}
                    </Text>
                    {meter(Math.min(100, r.percentUsed), heat(r.percentUsed))}
                  </Box>
                )
              })}
            </Box>,
          )}

        {section(
          'This session',
          <Box flexDirection="column">
            {usage.cost !== undefined && <Text bold>{`$${usage.cost.usd.toFixed(2)}`}</Text>}
            {isUp !== null && (
              <Text>
                <Text color={isUp ? pal.accent : pal.hot}>● </Text>
                <Text dimColor>{`9router ${isUp ? 'running' : 'not answering'}`}</Text>
              </Text>
            )}
          </Box>,
        )}

        {section(
          'Next up',
          <Box flexDirection="column" gap={1}>
            {list.length === 0 ? (
              <Text dimColor wrap="wrap">Nothing queued. Press What's next? and Claude will write the next three.</Text>
            ) : (
              <Box flexDirection="column">
                {list.map((t, i) => (
                  <Text key={`t${i}`} wrap="wrap" bold={i === 0} dimColor={i > 0}>
                    {`${i + 1}  ${t}`}
                  </Text>
                ))}
              </Box>
            )}
            <Box flexDirection="row" gap={2}>
              {list[0] && btn('continue', 'Continue', () => void send($, continueText(list[0]!, file)), { hotkey: 'c', isMain: true })}
              {btn('plan', "What's next?", () => void send($, planText(file)), { hotkey: 'n' })}
            </Box>
          </Box>,
        )}

        {section(
          'Mods',
          <Box flexDirection="column" gap={1}>
            {MODS.map(m => (
              <Box key={m.name} flexDirection="row" alignItems="center" gap={2}>
                <Box flexGrow={1} flexShrink={1} flexDirection="column">
                  <Text bold>{m.name}</Text>
                  <Text dimColor wrap="truncate-end">{m.note}</Text>
                </Box>
                {m.actions.map(a => (
                  btn(`${m.name}-${a.label}`, a.label, () => runMod($, a.command, a.args))
                ))}
              </Box>
            ))}
          </Box>,
        )}

        {shortcuts.length > 0 &&
          section(
            'Shortcuts',
            <Box flexDirection="row" gap={2} flexWrap="wrap">
              {shortcuts.map((q, i) => (
                btn(`quick-${i}`, q.label, () => void send($, q.prompt), { hotkey: String(i + 1) })
              ))}
            </Box>,
          )}

        <Text dimColor wrap="wrap">
          Tasks live in .claude/NEXT.md. /next adds one, /next done checks one off.
        </Text>
      </Box>
    )
  })
}
