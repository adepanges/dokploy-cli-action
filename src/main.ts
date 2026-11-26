import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { appendFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Api, type Deployment } from "./api.ts";
import { deployTarget, parseArgs } from "./args.ts";
import { redact } from "./redact.ts";

const DONE = new Set(["done", "error", "cancelled"]);

const input = (name: string) => (process.env[`INPUT_${name.toUpperCase().replaceAll("-", "_")}`] ?? "").trim();
const output = (name: string, value: string) => {
  const eof = `ghadelimiter_${randomUUID()}`;
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}<<${eof}\n${value}\n${eof}\n`);
};
const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000));
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function resolveId(api: Api, group: string, kind: string): Promise<string | undefined> {
  const id = input(`${group}-id`);
  if (id) return id;
  const name = input(`${group}-name`);
  if (!name) return;
  const params: Record<string, string> = { name, limit: "100" };
  if (input("project-id")) params.projectId = input("project-id");
  if (input("environment-id")) params.environmentId = input("environment-id");
  // shortcut: search is a substring match capped at 100 rows; exact match is filtered here
  const { items } = await api.get<{ items: Record<string, string>[] }>(`${group}.search`, params);
  const hits = items.filter((i) => i.name === name);
  if (hits.length !== 1) {
    const list = hits.map((h) => `${h[kind]} (environmentId ${h.environmentId})`).join(", ");
    throw new Error(hits.length ? `${group}-name "${name}" is ambiguous, add project-id or environment-id: ${list}` : `no ${group} named "${name}"`);
  }
  return hits[0][kind];
}

async function waitFor(api: Api, type: string, id: string, before: Set<string>, timeout: number, interval: number) {
  const deadline = Date.now() + timeout * 1000;
  while (Date.now() < deadline) {
    try {
      const fresh = (await api.deployments(type, id)).find((d) => !before.has(d.deploymentId));
      if (fresh && DONE.has(fresh.status)) return fresh;
    } catch (e) {
      console.log(`::warning::status check failed, retrying: ${message(e)}`);
    }
    await sleep(interval);
  }
  throw new Error(`deployment did not finish within ${timeout}s`);
}

async function main() {
  const url = input("url").replace(/\/+$/, "");
  const key = input("api-key");
  const headers: Record<string, string> = input("headers") ? JSON.parse(input("headers")) : {};
  for (const v of [key, ...Object.values(headers)]) if (v) console.log(`::add-mask::${v}`);

  const command = input("command").split(/\s+/).filter(Boolean);
  if (!url || !key || !command.length) throw new Error("url, api-key and command are required");
  const argv = [...command, ...parseArgs(input("args"))];
  const api = new Api(url, key, headers);

  const deploy = deployTarget(command);
  const group = command[0];
  const kind = group === "compose" ? "composeId" : group === "application" ? "applicationId" : undefined;
  let id: string | undefined;
  if (kind) {
    const at = argv.indexOf(`--${kind}`);
    id = at >= 0 ? argv[at + 1] : await resolveId(api, group, kind);
    if (at < 0 && id) argv.push(`--${kind}`, id);
  }

  const wait = input("wait") !== "false" && deploy !== undefined;
  if (wait && !id) throw new Error(`wait needs a target: set ${group}-id, ${group}-name or --${kind} in args`);
  const before = new Set(wait ? (await api.deployments(group, id!)).map((d) => d.deploymentId) : []);

  const res = spawnSync(process.execPath, [join(import.meta.dirname, "cli", "cli.mjs"), ...argv, "--json"], {
    cwd: mkdtempSync(join(tmpdir(), "dokploy-")), // the CLI reads ./.env, never the user's workspace
    env: { ...process.env, DOKPLOY_URL: url, DOKPLOY_API_KEY: key, DOKPLOY_EXTRA_HEADERS: JSON.stringify(headers) },
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    stdio: ["ignore", "pipe", "inherit"],
  });
  if (res.error) throw res.error;
  if (res.status !== 0) throw new Error(`dokploy ${command.join(" ")} exited with ${res.status}`);
  const stdout = res.stdout.trim();
  if (/^"?</.test(stdout)) {
    throw new Error("got an HTML page instead of JSON: an auth proxy (e.g. Cloudflare Access) blocked the request; pass its headers via `headers`");
  }
  output("result", stdout);
  try {
    console.log(JSON.stringify(redact(JSON.parse(stdout)), null, 2));
  } catch {
    console.log(`dokploy ${command.join(" ")}: ok`);
  }

  if (!wait) return;
  const d: Deployment = await waitFor(api, group, id!, before, Number(input("wait-timeout") || 600), Number(input("poll-interval") || 5));
  output("deployment-id", d.deploymentId);
  output("status", d.status);
  console.log(`deployment ${d.deploymentId}: ${d.status}`);
  if (d.status !== "done") {
    console.log(`::group::deployment log\n${await api.logs(d.deploymentId).catch(message)}\n::endgroup::`);
    throw new Error(`deployment ${d.status}: ${d.errorMessage ?? "see the deployment log"}`);
  }
}

main().catch((e) => {
  console.log(`::error::${message(e)}`);
  process.exitCode = 1;
});
