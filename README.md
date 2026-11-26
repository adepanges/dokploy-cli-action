# Dokploy CLI Action

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

## Outputs

| Output | |
| --- | --- |
| `result` | Raw JSON printed by the CLI. May contain secrets (e.g. `compose one` returns `env`): don't echo it. |
| `deployment-id` | The deployment waited for |
| `deployment-status` | `done`, `error` or `cancelled` |

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
- The bundled CLI is patched at runtime for two things: the extra `headers`, and read commands with
  parameters (e.g. `compose one`), which `@dokploy/cli` 0.30.7 sends in a shape the server rejects.

## Development

```bash
npm ci
npm run typecheck && npm test && npm run build
```

Releases:

1. Run **Prepare release** on `develop` and pick `patch`, `minor` or `major` (the first release is
   `v0.0.1`). It pushes `release/vX.Y.Z` and opens a PR to `master` whose body is the changeset; edit it
   if needed, it becomes the release notes.
2. Merge the PR. **Release** builds `dist/` into a tag commit, tags `vX.Y.Z`, moves `v0.<minor>` (or
   `v<major>` from 1.0), publishes the GitHub release with the changeset and deletes the release branch.

## License

MIT. Bundled third-party licenses are in `dist/THIRD_PARTY_LICENSES.txt` and `dist/cli/THIRD_PARTY_LICENSES.txt` of each release.
