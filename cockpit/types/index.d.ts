export type NextTask = string | null
export type Quick = { label: string; prompt: string }

declare module 'claude-code' {
  interface PluginState {
    'cockpit': {
      lastAt: number | null
      tick: number
      next: NextTask
      router: boolean | null
      quick: Quick[]
      quickOpen: boolean
    }
  }
}
