import { atom, read } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import {
  CLAY,
  COMPACT_AT,
  PANEL,
  TTL_MS,
  cacheTone,
  continueText,
  heat,
  nextFile,
  planText,
  until,
} from './shared'

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

// The empty part of a bar: a quiet neutral that follows the app's light or dark theme.
const TRACK_DARK = '#303030'
const TRACK_LIGHT = '#e6e3dc'
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
    const { Box, Text, Button } = $.ui.resolve(e)
    const theme = String((await $.config.list().catch(() => [])).find(r => r.key === 'theme')?.value ?? 'dark')
    const track = theme.includes('light') ? TRACK_LIGHT : TRACK_DARK

    const left = at === null ? null : TTL_MS - (now - at)
    const cache = cacheTone({ isWorking: false, left })
    const ctxPct = usage.context.percent

    // One labelled block; the title is dim and small so the numbers lead.
    const section = (title: string, children: unknown) => (
      <Box flexDirection="column">
        <Text dimColor>{title}</Text>
        {children}
      </Box>
    )
    // A solid bar: a track and a filled part sized in percent, so it is always exactly as wide as the
    // panel and can never wrap or show seams the way a row of block characters does.
    const meter = (pct: number, color?: string) => (
      <Box width="100%" height={1} backgroundColor={track}>
        <Box width={`${Math.max(0, Math.min(100, Math.round(pct)))}%`} height={1} backgroundColor={color ?? CLAY} />
      </Box>
    )

    return (
      <Box flexDirection="column" paddingX={2} paddingY={1} gap={1}>
        {section(
          'Prompt cache',
          <Box flexDirection="column">
            <Text>
              <Text bold color={cache.color}>
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
              {ctxPct !== undefined && <Text color={heat(ctxPct)}>{` · ${ctxPct}%`}</Text>}
              <Text dimColor>{` of ${windowLabel(usage.context.window)}`}</Text>
            </Text>
            {ctxPct !== undefined && meter(ctxPct, heat(ctxPct))}
            <Box>
              <Button key="compact" label="Compact" variant={(ctxPct ?? 0) >= COMPACT_AT ? 'primary' : 'secondary'} hotkey="k" onPress={() => compactNow($, file)} />
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
                      <Text bold color={heat(r.percentUsed)}>{` ${Math.round(r.percentUsed)}%`}</Text>
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
                <Text color={isUp ? 'green' : 'red'}>● </Text>
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
              {list[0] && <Button key="continue" label="Continue" variant="primary" hotkey="c" onPress={() => void send($, continueText(list[0]!, file))} />}
              <Button key="plan" label="What's next?" variant="secondary" hotkey="n" onPress={() => void send($, planText(file))} />
            </Box>
          </Box>,
        )}

        {shortcuts.length > 0 &&
          section(
            'Shortcuts',
            <Box flexDirection="row" gap={2} flexWrap="wrap">
              {shortcuts.map((q, i) => (
                <Button key={`quick-${i}`} label={q.label} variant="secondary" hotkey={String(i + 1)} onPress={() => void send($, q.prompt)} />
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
