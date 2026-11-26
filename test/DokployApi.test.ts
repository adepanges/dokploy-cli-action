import assert from "node:assert/strict";
import { test } from "node:test";
import { type Deployment, DokployApi } from "../src/DokployApi.ts";

const dep = (deploymentId: string, status: string): Deployment => ({ deploymentId, status, createdAt: "", errorMessage: null });

class FakeApi extends DokployApi {
  private readonly pages: Deployment[][];
  constructor(pages: Deployment[][]) {
    super("http://x", "k", {});
    this.pages = pages;
  }
  override async deployments() {
    const page = this.pages.length > 1 ? this.pages.shift()! : this.pages[0];
    if (!page.length) throw new Error("502");
    return page;
  }
}

const opts = (since: string[], timeoutSeconds = 1) => ({ since: new Set(since), timeoutSeconds, intervalSeconds: 0.01 });

test("waitForDeployment ignores old deployments and retries failed checks", async () => {
  let retries = 0;
  const api = new FakeApi([[dep("old", "done")], [], [dep("new", "running"), dep("old", "done")], [dep("new", "done"), dep("old", "done")]]);
  const d = await api.waitForDeployment("compose", "c", opts(["old"]), () => retries++);
  assert.equal(d.deploymentId, "new");
  assert.equal(retries, 1);
});

test("waitForDeployment returns a failed deployment", async () => {
  const d = await new FakeApi([[dep("new", "error")]]).waitForDeployment("compose", "c", opts([]));
  assert.equal(d.status, "error");
});

test("waitForDeployment times out", async () => {
  await assert.rejects(new FakeApi([[dep("new", "running")]]).waitForDeployment("compose", "c", opts([], 0.05)), /did not finish/);
});
