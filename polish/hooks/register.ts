import type { EngineInterface, Register } from 'claude-code'

import { HUMAN, acceptable, applyFixes, askText, isCandidate, learn, looksDictated, systemPrompt, unwrap, vocabulary, words } from './text'
import type { Fixes, Vocab } from './text'

type Mode = 'auto' | 'always' | 'off'
type Last = { original: string; cleaned: string; at: number }

const MODES: Mode[] = ['auto', 'always', 'off']

async function get<T>($: EngineInterface, key: string, fallback: T): Promise<T> {
  const v = await $.store.get(key)
  return v === undefined || v === null ? fallback : (v as T)
}

// Asks Haiku for the cleaned message. null means "send the person's own words": no answer, or an answer that failed the checks.
async function clean($: EngineInterface, text: string): Promise<string | null> {
  const manual = await get<string[]>($, 'manual', [])
  const learned = await get<Vocab>($, 'vocab', {})
  const fixes = await get<Fixes>($, 'fixes', {})
  const r = await $.model
    .complete({
      model: 'haiku',
      system: systemPrompt(vocabulary(manual, learned), fixes),
      prompt: askText(applyFixes(text, fixes)),
      maxTokens: Math.min(2000, Math.ceil(text.length / 3) + 120),
      effort: 'low',
      timeoutMs: 10_000,
    })
    .catch(() => null)
  if (r === null || !r.isAnswered) return null
  const out = unwrap(r.text)
  return acceptable(text, out) ? out : null
}

export const register: Register = (on, options) => {
  // review: the cleaned text waits in the box; pressing Enter on it sends it as it is.
  let allowOnce: string | null = null

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'polish',
      description: 'Clean dictated prompts with Haiku: /polish auto|always|off, send|review, add <term>, say <heard> = <right>, vocab, last, test <text>',
    })
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    if (!HUMAN.has(e.origin.kind)) return next(e)

    const mode = await get<Mode>($, 'mode', MODES.includes(options?.mode as Mode) ? (options.mode as Mode) : 'auto')
    const isReview = (await get<string>($, 'review', options?.review === 'review' ? 'review' : 'send')) === 'review'
    const text = e.text

    // The cleaned text the person confirmed with Enter goes through as it is.
    if (allowOnce !== null && text === allowOnce) {
      allowOnce = null
      await $.store.set('vocab', learn(await get<Vocab>($, 'vocab', {}), text))
      return next(e)
    }
    allowOnce = null

    const wantsClean = mode !== 'off' && isCandidate(text) && (mode === 'always' || looksDictated(text))
    if (!wantsClean) {
      if (isCandidate(text)) await $.store.set('vocab', learn(await get<Vocab>($, 'vocab', {}), text))
      return next(e)
    }

    void $.ui.status('polish: cleaning…')
    const cleaned = await clean($, text).catch(() => null)
    void $.ui.status(undefined)
    if (cleaned === null) return next(e)

    await $.store.set('last', { original: text, cleaned, at: await $.clock.now() } satisfies Last)

    if (isReview) {
      allowOnce = cleaned
      void $.prompt.fill({ text: cleaned }).catch(() => undefined)
      return { drop: `polish: cleaned ${words(text)} → ${words(cleaned)} words and put it back in the box. Enter sends it, or edit it first.` }
    }

    await $.store.set('vocab', learn(await get<Vocab>($, 'vocab', {}), cleaned))
    $.ui.toast(`polish: ${words(text)} → ${words(cleaned)} words. /polish last shows what you said.`)
    return next({
      ...e,
      text: cleaned,
      context: [
        ...(e.context ?? []),
        `The prompt above was cleaned from voice dictation. Here are the raw words, in case the cleanup lost something:\n${text}`,
      ],
    })
  })

  on('command.run', { command: 'polish' }, async ($, e) => {
    const arg = e.args.trim()
    const [head = '', ...rest] = arg.split(/\s+/)
    const tail = rest.join(' ').trim()

    if (head === 'on' || MODES.includes(head as Mode)) {
      const mode: Mode = head === 'on' ? 'always' : (head as Mode)
      await $.store.set('mode', mode)
      return { text: `polish: ${mode}. ${mode === 'auto' ? 'Prompts that read like dictation are cleaned.' : mode === 'always' ? 'Every prompt you type is cleaned.' : 'Nothing is cleaned.'}` }
    }
    if (head === 'send' || head === 'review') {
      await $.store.set('review', head)
      return { text: head === 'send' ? 'polish: the cleaned prompt is sent at once.' : 'polish: the cleaned prompt waits in the box for Enter.' }
    }
    if (head === 'add' && tail !== '') {
      const manual = await get<string[]>($, 'manual', [])
      await $.store.set('manual', [...new Set([...manual, tail])])
      return { text: `polish: will spell "${tail}" exactly.` }
    }
    if (head === 'say') {
      const m = /^(.+?)\s*=\s*(.+)$/.exec(tail)
      if (!m) return { text: 'polish: say <what it hears> = <what you mean>, for example: say pupsis portal = PUPSISPortal' }
      const fixes = await get<Fixes>($, 'fixes', {})
      await $.store.set('fixes', { ...fixes, [m[1]!.toLowerCase()]: m[2]!.trim() })
      return { text: `polish: "${m[1]}" will be read as "${m[2]!.trim()}".` }
    }
    if (head === 'forget' && tail !== '') {
      const manual = await get<string[]>($, 'manual', [])
      const learned = await get<Vocab>($, 'vocab', {})
      const fixes = await get<Fixes>($, 'fixes', {})
      delete learned[tail]
      delete fixes[tail.toLowerCase()]
      await $.store.set('manual', manual.filter(t => t !== tail))
      await $.store.set('vocab', learned)
      await $.store.set('fixes', fixes)
      return { text: `polish: forgot "${tail}".` }
    }
    if (head === 'vocab') {
      const manual = await get<string[]>($, 'manual', [])
      const learned = await get<Vocab>($, 'vocab', {})
      const fixes = await get<Fixes>($, 'fixes', {})
      const auto = Object.entries(learned).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} (${n})`)
      return {
        text: [
          `added by you: ${manual.join(', ') || 'none'}`,
          `learned from your prompts (seen 3+ times): ${auto.join(', ') || 'none yet'}`,
          `mishearings: ${Object.entries(fixes).map(([h, r]) => `${h} = ${r}`).join('; ') || 'none'}`,
        ].join('\n'),
      }
    }
    if (head === 'last') {
      const last = await get<Last | null>($, 'last', null)
      return { text: last === null ? 'polish: nothing cleaned yet.' : `you said:\n${last.original}\n\ncleaned:\n${last.cleaned}` }
    }
    if (head === 'test') {
      if (tail === '') return { text: 'polish: /polish test <some dictation>' }
      const cleaned = await clean($, tail)
      return { text: cleaned === null ? 'polish: no usable answer; your words would be sent as they are.' : cleaned }
    }

    const mode = await get<Mode>($, 'mode', MODES.includes(options?.mode as Mode) ? (options.mode as Mode) : 'auto')
    const review = await get<string>($, 'review', options?.review === 'review' ? 'review' : 'send')
    const manual = await get<string[]>($, 'manual', [])
    const learned = await get<Vocab>($, 'vocab', {})
    return {
      text: [
        `polish: ${mode}, ${review === 'review' ? 'cleaned text waits for Enter' : 'cleaned text is sent at once'}.`,
        `vocabulary: ${manual.length} added by you, ${Object.values(learned).filter(n => n >= 3).length} learned.`,
        '/polish auto|always|off   /polish send|review   /polish add <term>   /polish say <heard> = <right>',
        '/polish vocab   /polish forget <term>   /polish last   /polish test <text>',
      ].join('\n'),
    }
  })
}
