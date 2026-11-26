import { build } from "esbuild";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const common = { bundle: true, platform: "node", format: "esm", target: "node24", metafile: true, legalComments: "none" };

rmSync("dist", { recursive: true, force: true });
const main = await build({ ...common, entryPoints: ["src/main.ts"], outfile: "dist/index.js" });
// cli/cli.mjs: the CLI reads `../package.json` for its version, i.e. dist/package.json below
const cli = await build({
  ...common,
  entryPoints: ["src/cli-entry.ts"],
  outfile: "dist/cli/cli.mjs",
  banner: { js: "import {createRequire} from 'node:module';const require=createRequire(import.meta.url);" },
});
const version = require("@dokploy/cli/package.json").version;
writeFileSync("dist/package.json", JSON.stringify({ type: "module", version }) + "\n");

// MIT and friends require their notices to travel with the bundled code
const pkgs = new Set();
for (const { metafile } of [main, cli]) {
  for (const file of Object.keys(metafile.inputs)) {
    const m = /^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//.exec(file);
    if (m) pkgs.add(m[1]);
  }
}
const notices = [...pkgs].sort().map((dir) => {
  const { name, version, license, repository } = JSON.parse(readFileSync(`${dir}/package.json`, "utf8"));
  const file = readdirSync(dir).find((f) => /^licen[cs]e/i.test(f));
  const text = file ? readFileSync(`${dir}/${file}`, "utf8").trim() : `No license file in the published package; see ${repository?.url ?? repository ?? "its repository"}.`;
  return `${name}@${version} (${license})\n\n${text}\n`;
});
writeFileSync("dist/THIRD_PARTY_LICENSES.txt", notices.join("\n" + "-".repeat(72) + "\n\n"));
console.log(`dist built: @dokploy/cli ${version}, ${pkgs.size} bundled packages`);
