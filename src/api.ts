export type Deployment = { deploymentId: string; status: string; createdAt: string; errorMessage: string | null };

export class Api {
  private url: string;
  private key: string;
  private headers: Record<string, string>;

  constructor(url: string, key: string, headers: Record<string, string>) {
    this.url = url;
    this.key = key;
    this.headers = headers;
  }

  async get<T>(path: string, params: Record<string, string>): Promise<T> {
    const res = await fetch(`${this.url}/api/${path}?${new URLSearchParams(params)}`, {
      headers: { ...this.headers, "x-api-key": this.key },
    });
    const body = await res.text();
    if (!res.ok || body.trimStart().startsWith("<")) {
      throw new Error(`GET ${path} -> ${res.status}${body.startsWith("<") ? " (HTML: blocked by an auth proxy? pass its headers via `headers`)" : `: ${body.slice(0, 300)}`}`);
    }
    return JSON.parse(body);
  }

  deployments(type: string, id: string) {
    return this.get<Deployment[]>("deployment.allByType", { id, type });
  }

  logs(deploymentId: string) {
    return this.get<string>("deployment.readLogs", { deploymentId, tail: "200" });
  }
}
