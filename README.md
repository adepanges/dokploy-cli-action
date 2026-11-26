# Dokploy CLI Action

Run any command of the official [`@dokploy/cli`](https://www.npmjs.com/package/@dokploy/cli) from GitHub
Actions, and optionally wait until a deployment has finished.

> **Unofficial.** Not affiliated with Dokploy. It bundles the official CLI unchanged; the CLI version is
> pinned in `package.json` and kept current by Dependabot.

- Every CLI command works: `command` is the CLI path, `args` its flags.
- `compose`/`application` `deploy` and `redeploy` wait for the deployment to be `done` (or fail the step),
  unless `wait: false`.
- Target by id or by exact name.
- Works behind an auth proxy such as Cloudflare Access: pass its headers in `headers`.
- The job log shows env vars as `NAME: ok` and hides secret-looking fields; the raw JSON is only in
  the `result` output.

## Usage

```yaml
- uses: adepanges/dokploy-cli-action@v0.30.7
  with:
    url: https://dokploy.example.com
    api-key: ${{ secrets.DOKPLOY_API_KEY }}
    command: compose deploy
    compose-id: abc123
```

Always use a release tag: branches do not contain the built `dist/`. Versions follow the bundled CLI
plus a build number:

| Tag | Moves? | Means |
| --- | --- | --- |
| `v0.30.7.2` | no | CLI 0.30.7, second build of the action for it |
| `v0.30.7` | yes | latest build for CLI 0.30.7 |
| `v0` | yes | latest build for any CLI 0.x (follows the CLI's own breaking changes) |

### Trigger and forget

```yaml
  with:
    command: application redeploy
    application-id: abc123
    wait: false
```

### By name

Names are matched exactly. If the same name exists in several projects or environments, narrow it:

```yaml
  with:
    command: compose deploy
    compose-name: my-app
    environment-id: xyz789
```

### Behind Cloudflare Access (Zero Trust)

```yaml
  with:
    command: compose deploy
    compose-id: abc123
    headers: |
      {"CF-Access-Client-Id": "${{ secrets.CF_ACCESS_CLIENT_ID }}",
       "CF-Access-Client-Secret": "${{ secrets.CF_ACCESS_CLIENT_SECRET }}"}
```

### Any other command

```yaml
  with:
    command: compose save-environment
    compose-id: abc123
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
| `url` | | Dokploy server URL |
| `api-key` | | Dokploy API key |
| `command` | | CLI command path, e.g. `compose deploy`, `project all` |
| `args` | | Flags for the command, a JSON or YAML object (see above) |
| `compose-id` / `compose-name` | | Target compose; adds `--composeId` |
| `application-id` / `application-name` | | Target application; adds `--applicationId` |
| `project-id` / `environment-id` | | Narrow a `*-name` lookup |
| `wait` | `true` | Deploy/redeploy: wait for the result |
| `wait-timeout` | `600` | Seconds before the step fails |
| `poll-interval` | `5` | Seconds between status checks |
| `headers` | | JSON object of extra HTTP headers for every request |

## Outputs

| Output | |
| --- | --- |
| `result` | Raw JSON printed by the CLI. May contain secrets (e.g. `compose one` returns `env`): don't echo it. |
| `deployment-id` | The deployment waited for |
| `status` | `done`, `error` or `cancelled` |

When a deployment fails, its last 200 log lines are printed in a collapsed group.

## Notes

- The deployment waited for is the first one created after the trigger; two deploys of the same target
  started at the same moment can be confused.
- The bundled CLI is patched at runtime for two things: the extra `headers`, and read commands with
  parameters (e.g. `compose one`), which `@dokploy/cli` 0.30.7 sends in a shape the server rejects.

## Development

```bash
npm ci
npm run typecheck && npm test && npm run build
```

Releases: run the **Release** workflow (it builds `master`). It builds `dist/`, tags
`v<cli>.<build>` (the next build number for the bundled CLI version) and moves `v<cli>` and `v<major>`.

## License

MIT. Bundled third-party licenses are in `dist/THIRD_PARTY_LICENSES.txt` and `dist/cli/THIRD_PARTY_LICENSES.txt` of each release.
