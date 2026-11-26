import type { AxiosStatic, InternalAxiosRequestConfig } from "axios";

// Patches the CLI's axios: extra headers (e.g. Cloudflare Access) on every client, and GET `input`
// wrapped in {json:…}, which @dokploy/cli 0.30.7 omits (400 on every GET with params).
export class CliPatch {
  static wrapInput(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
    const m = /([?&])input=([^&]*)/.exec(config.url ?? "");
    if (!m) return config;
    try {
      const v = JSON.parse(decodeURIComponent(m[2]));
      if (!v || typeof v !== "object" || "json" in v) return config;
      config.url = config.url!.replace(m[0], `${m[1]}input=${encodeURIComponent(JSON.stringify({ json: v }))}`);
    } catch {
      // not JSON: leave the request as the CLI built it
    }
    return config;
  }

  static install(axios: AxiosStatic, headers: Record<string, string>) {
    const create = axios.create.bind(axios);
    axios.create = (cfg) => {
      const client = create({ ...cfg, headers: { ...cfg?.headers, ...headers } });
      client.interceptors.request.use(CliPatch.wrapInput);
      return client;
    };
  }
}
