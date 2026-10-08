export type Tally = { converted: number; reused: number; failed: number }

/** The last thing worth telling the person, for a pane to show. */
export type Notice = { text: string; at: number }

declare module 'claude-code' {
  interface PluginState {
    conversor: {
      /** Sources markitdown could not convert, by path, with their mtime then. */
      failures: Record<string, number>
      tally: Tally
      isPaused: boolean
      notice: Notice | null
    }
  }
}
