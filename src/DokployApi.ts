export type Deployment = { deploymentId: string; status: string; createdAt: string; errorMessage: string | null };
export type Scope = { projectId?: string; environmentId?: string };
export type WaitOptions = { since: Set<string>; timeoutSeconds: number; intervalSeconds: number };

export class DokployApi {
  static readonly AUTH_PROXY_HINT =
    "got an HTML page instead of JSON: an auth proxy (e.g. Cloudflare Access) blocked the request; pass its headers via `headers`";
  private static readonly FINAL_STATUSES = new Set(["done", "error", "cancelled"]);

  private readonly url: string;
  private readonly key: string;
  private readonly headers: Record<string, string>;

  constructor(url: string, key: string, headers: Record<string, string>) {
    this.url = url;
    this.key = key;
    this.headers = headers;
  }

  static isHtml(body: string) {
    return /^"?</.test(body.trimStart());
  }

  async get<T>(path: string, params: Record<string, string>): Promise<T> {
    const res = await fetch(`${this.url}/api/${path}?${new URLSearchParams(params)}`, {
      headers: { ...this.headers, "x-api-key": this.key },
    });
    const body = await res.text();
    if (DokployApi.isHtml(body)) throw new Error(`GET ${path} -> ${res.status}: ${DokployApi.AUTH_PROXY_HINT}`);
    if (!res.ok) throw new Error(`GET ${path} -> ${res.status}: ${body.slice(0, 300)}`);
    return JSON.parse(body);
  }

  deployments(type: string, id: string) {
    return this.get<Deployment[]>("deployment.allByType", { id, type });
  }

  logs(deploymentId: string) {
    return this.get<string>("deployment.readLogs", { deploymentId, tail: "200" });
  }

  async findId(group: string, idField: string, name: string, scope: Scope): Promise<string> {
    // shortcut: search is a substring match capped at 100 rows; the exact match is filtered here
    const params: Record<string, string> = { name, limit: "100" };
    if (scope.projectId) params.projectId = scope.projectId;
    if (scope.environmentId) params.environmentId = scope.environmentId;
    const { items } = await this.get<{ items: Record<string, string>[] }>(`${group}.search`, params);
    const hits = items.filter((i) => i.name === name);
    if (hits.length === 1) return hits[0][idField];
    if (!hits.length) throw new Error(`no ${group} named "${name}"`);
    const list = hits.map((h) => `${h[idField]} (environmentId ${h.environmentId})`).join(", ");
    throw new Error(`${group}-name "${name}" is ambiguous, add project-id or environment-id: ${list}`);
  }

  // The deployment waited for is the first one not in `since` (ids that existed before the trigger).
  async waitForDeployment(type: string, id: string, opts: WaitOptions, onRetry: (e: unknown) => void = () => {}) {
    const deadline = Date.now() + opts.timeoutSeconds * 1000;
    while (Date.now() < deadline) {
      try {
        const fresh = (await this.deployments(type, id)).find((d) => !opts.since.has(d.deploymentId));
        if (fresh && DokployApi.FINAL_STATUSES.has(fresh.status)) return fresh;
      } catch (e) {
        onRetry(e);
      }
      await new Promise((r) => setTimeout(r, opts.intervalSeconds * 1000));
    }
    throw new Error(`deployment did not finish within ${opts.timeoutSeconds}s`);
  }
}
