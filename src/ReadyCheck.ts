export type ReadyOptions = { url: string; match: string; timeoutSeconds: number; intervalSeconds: number };

// A deployment Dokploy reports `done` has started its containers, not necessarily a serving app.
export class ReadyCheck {
  // Resolves once `url` answers 2xx (and contains `match`, when set). Redirects are not followed
  // and the body is never echoed: it may hold anything the app prints.
  static async waitFor(opts: ReadyOptions, onWait: (state: string) => void = () => {}): Promise<void> {
    const deadline = Date.now() + opts.timeoutSeconds * 1000;
    for (;;) {
      const state = await ReadyCheck.probe(opts.url, opts.match);
      if (state === null) return;
      if (Date.now() >= deadline) throw new Error(`ready-url not ready within ${opts.timeoutSeconds}s: ${state}`);
      onWait(state);
      await new Promise((r) => setTimeout(r, opts.intervalSeconds * 1000));
    }
  }

  /** `null` when ready, else what was wrong. */
  private static async probe(url: string, match: string): Promise<string | null> {
    try {
      const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(10_000) });
      const body = await res.text();
      if (!res.ok) return `HTTP ${res.status}`;
      if (match && !body.includes(match)) return `HTTP ${res.status} without ready-match`;
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  }
}
