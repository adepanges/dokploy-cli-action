import assert from "node:assert/strict";
import { test } from "node:test";
import type { InternalAxiosRequestConfig } from "axios";
import { CliPatch } from "../src/CliPatch.ts";

const wrap = (url: string) => CliPatch.wrapInput({ url } as InternalAxiosRequestConfig).url;
const q = (v: unknown) => encodeURIComponent(JSON.stringify(v));

test("wrapInput wraps a bare object and leaves everything else alone", () => {
  assert.equal(wrap(`/trpc/compose.one?input=${q({ composeId: "a" })}`), `/trpc/compose.one?input=${q({ json: { composeId: "a" } })}`);
  assert.equal(wrap(`/trpc/x?input=${q({ json: { a: 1 } })}`), `/trpc/x?input=${q({ json: { a: 1 } })}`);
  assert.equal(wrap(`/trpc/x?input=${q(5)}`), `/trpc/x?input=${q(5)}`);
  assert.equal(wrap("/trpc/x?input=not-json"), "/trpc/x?input=not-json");
  assert.equal(wrap("/trpc/project.all"), "/trpc/project.all");
});
