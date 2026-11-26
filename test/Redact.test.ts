import assert from "node:assert/strict";
import { test } from "node:test";
import { Redact } from "../src/Redact.ts";

test("Redact hides env values and secret fields, keeps the rest", () => {
  const out = Redact.json({
    name: "app",
    composeId: "abc",
    env: '# c\nDATABASE_URL=postgres://u:p@h/db\nKEY="-----BEGIN KEY-----\nMIIEvQIBADANBg\n-----END KEY-----"\nexport EMPTY=\n',
    previewBuildArgs: "A=1",
    buildSecrets: ["S=hunter2"],
    databasePassword: "hunter2",
    refreshToken: "t",
    nested: [{ apiKey: "k", environmentId: "e" }],
  });
  assert.deepEqual(out, {
    name: "app",
    composeId: "abc",
    env: ["DATABASE_URL: ok", "KEY: ok", "EMPTY: ok"],
    previewBuildArgs: ["A: ok"],
    buildSecrets: [["S: ok"]],
    databasePassword: "***",
    refreshToken: "***",
    nested: [{ apiKey: "***", environmentId: "e" }],
  });
});
