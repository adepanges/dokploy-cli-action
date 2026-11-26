// esbuild, not @vercel/ncc: ncc's TypeScript loader needs the TS compiler API, which TypeScript 7 no longer ships.
import { build } from "esbuild";
import license from "esbuild-plugin-license";
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const common = {
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  legalComments: "none",
  // bundled CommonJS deps (axios' form-data, …) call require()
  banner: { js: "import {createRequire} from 'node:module';const require=createRequire(import.meta.url);" },
};
const notices = (file) =>
  license({
    banner: "",
    thirdParty: {
      output: {
        file,
        template: (deps) => deps.map((d) => `${d.packageJson.name}@${d.packageJson.version} (${d.packageJson.license})\n\n${d.licenseText ?? ""}`.trim()).join("\n\n---\n\n") + "\n",
      },
    },
  });

await build({ ...common, entryPoints: ["src/main.ts"], outfile: "dist/index.js", plugins: [notices("dist/THIRD_PARTY_LICENSES.txt")] });
// the CLI reads its version from `../package.json`, i.e. dist/package.json
await build({ ...common, entryPoints: ["src/cli-entry.ts"], outfile: "dist/cli/cli.mjs", plugins: [notices("dist/cli/THIRD_PARTY_LICENSES.txt")] });
writeFileSync("dist/package.json", JSON.stringify({ type: "module", version: require("@dokploy/cli/package.json").version }) + "\n");
