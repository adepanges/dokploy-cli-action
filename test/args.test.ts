import assert from "node:assert/strict";
import { test } from "node:test";
import { deployTarget, parseArgs } from "../src/args.ts";

test("parseArgs reads JSON and flag lines", () => {
  assert.deepEqual(parseArgs('{"title":"a b","freshVolumes":true,"x":false}'), ["--title", "a b", "--freshVolumes"]);
  assert.deepEqual(parseArgs("--title a b\n--freshVolumes\n"), ["--title", "a b", "--freshVolumes"]);
  assert.deepEqual(parseArgs(""), []);
  assert.throws(() => parseArgs("title x"));
});

test("deployTarget only matches deploy-type commands", () => {
  assert.deepEqual(deployTarget(["compose", "redeploy"]), { group: "compose", id: "composeId" });
  assert.equal(deployTarget(["compose", "stop"]), undefined);
  assert.equal(deployTarget(["postgres", "deploy"]), undefined);
});
