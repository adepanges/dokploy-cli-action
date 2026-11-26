import assert from "node:assert/strict";
import { test } from "node:test";
import { Command } from "../src/Command.ts";

test("parseObject reads JSON and YAML, and never echoes bad input", () => {
  assert.deepEqual(Command.parseObject("args", '{"title":"a b","freshVolumes":true}'), { title: "a b", freshVolumes: true });
  assert.deepEqual(Command.parseObject("args", "title: a b\nfreshVolumes: true\n"), { title: "a b", freshVolumes: true });
  assert.deepEqual(Command.parseObject("args", ""), {});
  assert.throws(() => Command.parseObject("headers", '{"Secret": "hunter2'), (e: Error) => !e.message.includes("hunter2"));
  assert.throws(() => Command.parseObject("args", "[1]"), /must be an object/);
});

test("argv, deploy detection and target id", () => {
  const cmd = new Command("compose  redeploy", { title: "x y", freshVolumes: true, skip: false });
  assert.equal(cmd.isDeploy, true);
  assert.equal(cmd.id, undefined);
  assert.deepEqual(cmd.withId("abc").argv(), ["compose", "redeploy", "--title", "x y", "--freshVolumes", "--composeId", "abc"]);
  assert.equal(new Command("application deploy", { applicationId: "a1" }).id, "a1");
  assert.equal(new Command("compose stop", {}).isDeploy, false);
  assert.equal(new Command("postgres deploy", {}).isDeploy, false);
  assert.equal(new Command("postgres stop", {}).idField, "postgresId");
  assert.equal(new Command("preview-deployment redeploy", {}).idField, "previewDeploymentId");
});
