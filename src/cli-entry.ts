// Bundled CLI entry: adds DOKPLOY_EXTRA_HEADERS (e.g. Cloudflare Access) to every request and
// wraps GET `input` in {json:…}, which @dokploy/cli 0.30.7 omits (400 on every GET with params).
import axios, { type InternalAxiosRequestConfig } from "axios";

const extra = JSON.parse(process.env.DOKPLOY_EXTRA_HEADERS || "{}");

function wrapInput(config: InternalAxiosRequestConfig) {
  const m = /([?&])input=([^&]*)/.exec(config.url ?? "");
  if (!m) return config;
  const v = JSON.parse(decodeURIComponent(m[2]));
  if (!("json" in v)) config.url = config.url!.replace(m[0], `${m[1]}input=${encodeURIComponent(JSON.stringify({ json: v }))}`);
  return config;
}

const create = axios.create.bind(axios);
axios.create = (cfg) => {
  const client = create({ ...cfg, headers: { ...cfg?.headers, ...extra } });
  client.interceptors.request.use(wrapInput);
  return client;
};

await import("@dokploy/cli/dist/index.js");
