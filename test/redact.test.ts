import assert from "node:assert/strict";
import { test } from "node:test";
import { redact } from "../src/redact.ts";

test("redact hides env values and secret fields, keeps the rest", () => {
  const out = redact({
    name: "app",
    composeId: "abc",
    env: "# c\nDATABASE_URL=postgres://u:p@h/db\nEMPTY=\n",
    previewBuildArgs: "A=1",
    databasePassword: "hunter2",
    refreshToken: "t",
    nested: [{ apiKey: "k", environmentId: "e" }],
  });
  assert.deepEqual(out, {
    name: "app",
    composeId: "abc",
    env: ["DATABASE_URL: ok", "EMPTY: ok"],
    previewBuildArgs: ["A: ok"],
    databasePassword: "***",
    refreshToken: "***",
    nested: [{ apiKey: "***", environmentId: "e" }],
  });
});
