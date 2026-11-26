import * as core from "@actions/core";
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "./Command.ts";
import { DokployApi } from "./DokployApi.ts";
import { Redact } from "./Redact.ts";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

function seconds(name: string): number {
  const n = Number(core.getInput(name));
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${name} must be a positive number of seconds`);
  return n;
}

function runCli(cmd: Command, url: string, key: string, headers: Record<string, string>): string {
  const res = spawnSync(process.execPath, [join(import.meta.dirname, "cli", "cli.mjs"), ...cmd.argv(), "--json"], {
    cwd: mkdtempSync(join(tmpdir(), "dokploy-")), // the CLI reads ./.env, never the user's workspace
    env: { ...process.env, DOKPLOY_URL: url, DOKPLOY_API_KEY: key, DOKPLOY_EXTRA_HEADERS: JSON.stringify(headers) },
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    stdio: ["ignore", "pipe", "inherit"],
  });
  if (res.error) throw res.error;
  if (res.status !== 0) throw new Error(`dokploy ${cmd.path.join(" ")} exited with ${res.status}`);
  const stdout = res.stdout.trim();
  if (DokployApi.isHtml(stdout)) throw new Error(DokployApi.AUTH_PROXY_HINT);
  return stdout;
}

async function main() {
  const url = core.getInput("url", { required: true }).replace(/\/+$/, "");
  const key = core.getInput("api-key", { required: true });
  core.setSecret(key);
  const headers = Command.parseObject("headers", core.getInput("headers")) as Record<string, string>;
  for (const v of Object.values(headers)) if (v) core.setSecret(String(v));

  let cmd = new Command(core.getInput("command", { required: true }), Command.parseObject("args", core.getInput("args")));
  const api = new DokployApi(url, key, headers);

  if (cmd.idField && !cmd.id) {
    const id = core.getInput(`${cmd.group}-id`);
    const name = core.getInput(`${cmd.group}-name`);
    const scope = { projectId: core.getInput("project-id"), environmentId: core.getInput("environment-id") };
    if (id || name) cmd = cmd.withId(id || (await api.findId(cmd.group, cmd.idField, name, scope)));
  }

  const wait = cmd.isDeploy && core.getBooleanInput("wait");
  if (wait && !cmd.id) throw new Error(`wait needs a target: set ${cmd.group}-id, ${cmd.group}-name or ${cmd.idField} in args`);
  const timeoutSeconds = wait ? seconds("wait-timeout") : 0;
  const intervalSeconds = wait ? seconds("poll-interval") : 0;
  const since = new Set(wait ? (await api.deployments(cmd.group, cmd.id!)).map((d) => d.deploymentId) : []);

  const stdout = runCli(cmd, url, key, headers);
  core.setOutput("result", stdout);
  try {
    console.log(JSON.stringify(Redact.json(JSON.parse(stdout)), null, 2));
  } catch {
    console.log(`dokploy ${cmd.path.join(" ")}: ok`);
  }

  if (!wait) return;
  const d = await api.waitForDeployment(cmd.group, cmd.id!, { since, timeoutSeconds, intervalSeconds }, (e) =>
    core.warning(`status check failed, retrying: ${message(e)}`),
  );
  core.setOutput("deployment-id", d.deploymentId);
  core.setOutput("status", d.status);
  console.log(`deployment ${d.deploymentId}: ${d.status}`);
  if (d.status !== "done") {
    const log = await api.logs(d.deploymentId).catch(message);
    await core.group("deployment log", async () => console.log(log));
    throw new Error(`deployment ${d.status}: ${d.errorMessage ?? "see the deployment log"}`);
  }
}

main().catch((e) => core.setFailed(message(e)));
