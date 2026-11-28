# Dokploy CLI Action

[![Marketplace](https://img.shields.io/badge/Marketplace-Dokploy%20CLI%20Action-blue?logo=github)](https://github.com/marketplace/actions/dokploy-cli-action)
[![Release](https://img.shields.io/github/v/release/adepanges/dokploy-cli-action)](https://github.com/adepanges/dokploy-cli-action/releases/latest)
[![Bundled CLI](https://img.shields.io/github/package-json/dependency-version/adepanges/dokploy-cli-action/@dokploy/cli?branch=master)](https://www.npmjs.com/package/@dokploy/cli)
[![CI](https://github.com/adepanges/dokploy-cli-action/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/adepanges/dokploy-cli-action/actions/workflows/ci.yml)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/adepanges/dokploy-cli-action/badge)](https://scorecard.dev/viewer/?uri=github.com/adepanges/dokploy-cli-action)
[![License: MIT](https://img.shields.io/github/license/adepanges/dokploy-cli-action)](LICENSE)

Run any command of the official [`@dokploy/cli`](https://www.npmjs.com/package/@dokploy/cli) from GitHub
Actions, and optionally wait until a deployment has finished.

> **Unofficial.** Not affiliated with Dokploy. It bundles the official CLI unchanged; the CLI version is
> pinned in `package.json` and kept current by Dependabot.

- Every CLI command works: `command` is the CLI path, `args` its flags.
- `compose`/`application` `deploy` and `redeploy` wait for the deployment to be `done` (or fail the step),
  unless `wait: false`.
- Target by `id` or exact `name`, for any group: `compose deploy` gets `--composeId`, `postgres stop`
  gets `--postgresId`.
- Works behind an auth proxy such as Cloudflare Access: pass its headers in `headers`.
- The job log never prints the CLI's JSON: only `dokploy <command>: ok` and the names of any env vars in
  it (`NAME: ok`). The raw JSON is only in the `result` output.

## Usage

```yaml
- uses: adepanges/dokploy-cli-action@v0.0
  with:
    url: https://dokploy.example.com
    api-key: ${{ secrets.DOKPLOY_API_KEY }}
    command: compose deploy
    id: abc123
```

Always use a release tag: branches do not contain the built `dist/`. The action has its own
[semver](https://semver.org) version; each release names the `@dokploy/cli` version it bundles.

| Tag | Moves? | Means |
| --- | --- | --- |
| `v0.1.2` | no | one exact release |
| `v0.1` | yes | latest `0.1.x` (while in 0.x, a minor release may change inputs) |
| `v1` | yes | latest `1.x.x`, from 1.0.0 on |

A major release (a minor one while in 0.x) is the only kind that renames or removes inputs or outputs.

### Trigger and forget

```yaml
  with:
    command: application redeploy
    id: abc123
    wait: false
```

### Wait until the app serves

Dokploy reports a deployment `done` once its containers have started, which can be a few seconds
before the app answers. `ready-url` (optional) keeps the step going until that URL answers 2xx,
and `ready-match` until its body also contains a given text, such as the commit your health
endpoint reports:

```yaml
  with:
    command: compose deploy
    id: abc123
    ready-url: https://api.example.com/health
    ready-match: ${{ github.sha }}   # or a short sha, if that is what the endpoint prints
    ready-timeout: 180
```

### By name

Names are matched exactly through `<group>.search`, which Dokploy has for compose, application,
postgres, mysql, mariadb, mongo, redis, project and environment. If the same name exists in several
projects or environments, narrow it (`project-id` and `environment-id` only scope the lookup; they are
not passed to the command):

```yaml
  with:
    command: compose deploy
    name: my-app
    environment-id: xyz789
```

### Behind Cloudflare Access (Zero Trust)

```yaml
  with:
    command: compose deploy
    id: abc123
    headers: |
      CF-Access-Client-Id: ${{ secrets.CF_ACCESS_CLIENT_ID }}
      CF-Access-Client-Secret: ${{ secrets.CF_ACCESS_CLIENT_SECRET }}
```

`headers` is a JSON or YAML object, like `args`.

### Any other command

```yaml
  with:
    command: compose save-environment
    id: abc123
    args: |
      env: |
        NODE_ENV=production
        LOG_LEVEL=info
```

`args` is a JSON or YAML object: each key becomes `--key value`, `true` adds a bare flag, `false`/`null`
drops it. Run `npx @dokploy/cli <group> <command> --help` for a command's flags. A malformed `args` or
`headers` fails with a message that does not quote it, so secrets in it stay out of the log.

## Inputs

| Input | Default | |
| --- | --- | --- |
| `url` | | Dokploy server base URL, without `/api` |
| `api-key` | | Dokploy API key |
| `command` | | CLI command path, e.g. `compose deploy`, `project all` |
| `args` | | Flags for the command, a JSON or YAML object (see above) |
| `id` | | Target id, passed as `--<group>Id` |
| `name` | | Target by exact name instead of `id` |
| `project-id` / `environment-id` | | Narrow a `name` lookup; not passed to the command |
| `wait` | `true` | `compose`/`application` deploy and redeploy: wait for the result |
| `wait-timeout` | `600` | Seconds before the step fails |
| `poll-interval` | `5` | Seconds between status checks |
| `print-logs` | `false` | Print the last 200 log lines of a failed deployment (they can contain env values a build echoes) |
| `headers` | | JSON or YAML object of extra HTTP headers for every request |
| `ready-url` | | Optional: after the deployment is `done`, poll this URL until it answers 2xx |
| `ready-match` | | Optional, with `ready-url`: text the response body must contain |
| `ready-timeout` | `120` | Seconds `ready-url` may take before the step fails |

## Outputs

| Output | |
| --- | --- |
| `result` | Raw JSON printed by the CLI. May contain secrets (e.g. `compose one` returns `env`): don't echo it. |
| `deployment-id` | The deployment waited for |
| `deployment-status` | `done`, `error` or `cancelled` |
| `ready` | `true` once `ready-url` answered (set only with `ready-url`) |

When a deployment fails, the step fails with Dokploy's `errorMessage`; set `print-logs: true` to also
print its last 200 log lines in a collapsed group.

## Notes

- Set the target once: `id`, `name` or the id flag in `args`; two of them fail the step.
- Only compose and application deployments can be waited for: other groups' deploys (postgres, redis, …)
  are triggered and the step returns.
- The deployment waited for is the first one created after the trigger; two deploys of the same target
  started at the same moment can be confused.
- Redirects are refused, by the action and by the bundled CLI: following one would send the API key
  and `headers` to another host.
- `ready-url` gets no `headers` and follows no redirect, and its response body is never printed: the
  URL must answer without the Dokploy credentials (a public health endpoint, or one your proxy bypasses).
- The bundled CLI is patched at runtime for two things: the extra `headers`, and read commands with
  parameters (e.g. `compose one`), which `@dokploy/cli` 0.30.7 sends in a shape the server rejects.

## Verifying a release

Each release's `dist/` is built by the Release workflow, with a build provenance attestation and an
SPDX SBOM of its bundled dependencies. The SBOM and both signed attestation bundles
(`*.intoto.jsonl`) are also attached to the GitHub release:

```bash
git clone --depth 1 --branch v0.0.2 https://github.com/adepanges/dokploy-cli-action
cd dokploy-cli-action
gh attestation verify dist/index.js --repo adepanges/dokploy-cli-action
gh attestation verify dist/index.js --repo adepanges/dokploy-cli-action --predicate-type https://spdx.dev/Document/v2.3
```

## Development

```bash
npm ci
npm run typecheck && npm test && npm run build
```

Releases:

1. Run **Prepare release** on `develop` and pick `patch`, `minor` or `major` (the first release is
   `v0.0.1`). It pushes `release/vX.Y.Z` (one commit setting the `package.json` version), opens a PR to
   `master` whose body is the changeset (edit it if needed: it becomes the release notes), and runs
   **Release build**.
2. **Release build** reviews dependency changes since `master`, tests, builds `dist/`, attests it
   (provenance and SBOM), uploads it as an artifact named after the commit, and sets the commit status
   `release-build`. It runs again on every push to the release branch, so extra commits there are fine.
3. Merge the PR once `release-build` is green (a ruleset on `master` requires it). **Release** installs
   and builds nothing: it downloads the artifact of the PR head, verifies its attestations, puts it in a
   tag commit, tags `vX.Y.Z`, moves `v0.<minor>` (or `v<major>` from 1.0), publishes the GitHub release
   with the changeset and the SBOM, deletes the release branch and merges `master` back into `develop`.

## License

MIT. Bundled third-party licenses are in `dist/THIRD_PARTY_LICENSES.txt` and `dist/cli/THIRD_PARTY_LICENSES.txt` of each release.
