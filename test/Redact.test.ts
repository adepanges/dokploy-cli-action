import assert from "node:assert/strict";
import { test } from "node:test";
import { Redact } from "../src/Redact.ts";

test("Redact lists env names only, from strings, arrays and objects", () => {
  const out = Redact.envNames({
    name: "app",
    webhookUrl: "https://hooks.slack.com/services/SECRET",
    customGitUrl: "https://token@github.com/x/y",
    env: '# c\nDATABASE_URL=postgres://u:p@h/db\nKEY="-----BEGIN KEY-----\nMIIEvQIBADANBg\n-----END KEY-----"\nexport EMPTY=\n',
    previewBuildArgs: "A=1",
    buildSecrets: ["S=hunter2"],
    nested: [{ env: { OBJ_VAR: "secret" } }],
  });
  assert.deepEqual(out, ["DATABASE_URL: ok", "KEY: ok", "EMPTY: ok", "A: ok", "S: ok", "OBJ_VAR: ok"]);
  assert.ok(!JSON.stringify(out).match(/SECRET|token@|hunter2|secret|MIIE/));
});
