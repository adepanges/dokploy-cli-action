import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, before, test } from "node:test";
import { ReadyCheck } from "../src/ReadyCheck.ts";

let server: Server;
let base = "";
let hits = 0;

before(async () => {
  server = createServer((req, res) => {
    hits++;
    if (req.url === "/redirect") return res.writeHead(302, { location: "http://elsewhere.invalid/" }).end();
    if (req.url === "/late" && hits < 3) return res.writeHead(404).end("not yet");
    res.writeHead(200, { "content-type": "application/json" }).end('{"status":"ok","hash":"abc1234"}');
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
after(() => server.close());

const opts = (path: string, match = "", timeoutSeconds = 1) => ({ url: base + path, match, timeoutSeconds, intervalSeconds: 0.01 });

test("waitFor retries until the url answers 2xx", async () => {
  hits = 0;
  const waits: string[] = [];
  await ReadyCheck.waitFor(opts("/late"), (s) => waits.push(s));
  assert.deepEqual(waits, ["HTTP 404", "HTTP 404"]);
});

test("waitFor requires ready-match in the body when set", async () => {
  await ReadyCheck.waitFor(opts("/ok", '"hash":"abc1234"'));
  await assert.rejects(ReadyCheck.waitFor(opts("/ok", '"hash":"fff0000"', 0.05)), /not ready within 0.05s: HTTP 200 without ready-match/);
});

test("waitFor does not follow redirects", async () => {
  await assert.rejects(ReadyCheck.waitFor(opts("/redirect", "", 0.05)), /HTTP 302/);
});

test("waitFor reports an unreachable url and never echoes the body", async () => {
  await assert.rejects(ReadyCheck.waitFor({ ...opts("/", "", 0.05), url: "http://127.0.0.1:1/" }), (e: Error) => !e.message.includes("abc1234"));
});
