import type { Register } from 'claude-code'

// The user's rule: Claude never appears as a co-author on commits, PRs or merges.
const CLAUDE_CREDIT =
  /co-authored-by:[^\n"']*(claude|anthropic)|noreply@anthropic\.com|generated with \[?claude code/i

const SECRETS: [string, RegExp][] = [
  ['sk- API key', /\bsk-[A-Za-z0-9_-]{16,}/],
  ['sk_ API key', /\bsk_[A-Za-z0-9]{24,}/],
  ['GitHub token', /\b(ghp_|gho_|ghs_|github_pat_)[A-Za-z0-9_]{20,}/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['Slack token', /\bxox[abpr]-[A-Za-z0-9-]{10,}/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
]

const UI_WORDS =
  /\b(ui|ux|design|redesign|layout|colou?rs?|theme|palette|animations?|animate|pixel|fonts?|typography|css|styling|landing page|visual)\b/i

function findSecret(text: string): string | null {
  return SECRETS.find(([, re]) => re.test(text))?.[0] ?? null
}

function hasClaudeCredit(command: string): boolean {
  return CLAUDE_CREDIT.test(command)
}

export const register: Register = on => {
  let allowOnce: string | null = null

  on('tool.call', { tool: 'Bash' }, ($, e, next) =>
    hasClaudeCredit(e.command)
      ? {
          deny:
            'guards: the user never wants Claude credited. Remove every Co-Authored-By Claude/Anthropic trailer and any "Generated with Claude Code" line, then run it again.',
        }
      : next(e),
  )

  on('prompt.submit', async ($, e, next) => {
    if (e.origin?.kind === 'plugin') return next(e)

    const secret = findSecret(e.text)
    if (secret && allowOnce !== e.text) {
      allowOnce = e.text
      void $.prompt.fill({ text: e.text }).catch(() => undefined)
      return {
        drop: `Held back: this looks like a ${secret}. Anything sent stays in plain text in the transcript. Put it in an env file or a config instead, or press Enter again to send anyway.`,
      }
    }
    allowOnce = null

    const wantsDesign =
      !e.text.startsWith('/') && UI_WORDS.test(e.text) && !/impeccable|frontend-design/i.test(e.text)
    if (wantsDesign) {
      return next({
        ...e,
        context: [
          ...(e.context ?? []),
          'This request touches UI or visual design: load and follow the impeccable skill (and frontend-design:frontend-design where it fits) before designing.',
        ],
      })
    }

    return next(e)
  })
}
