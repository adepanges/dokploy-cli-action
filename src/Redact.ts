import { parse } from "dotenv";

// The job log never shows CLI JSON (webhook URLs, git/db URLs, compose files, mounts all carry secrets).
// It shows only the names of env vars found in dotenv-like fields, as `NAME: ok`. `result` stays raw.
export class Redact {
  private static readonly DOTENV = /(env|buildArgs|buildSecrets)$/i;

  static envNames(value: unknown): string[] {
    const names = new Set<string>();
    Redact.walk(value, "", names);
    return [...names].map((name) => `${name}: ok`);
  }

  private static walk(value: unknown, key: string, names: Set<string>) {
    if (Redact.DOTENV.test(key)) {
      if (typeof value === "string") Object.keys(parse(value)).forEach((n) => names.add(n));
      else if (Array.isArray(value)) value.forEach((v) => Redact.walk(v, key, names));
      else if (value && typeof value === "object") Object.keys(value).forEach((n) => names.add(n));
      return;
    }
    if (Array.isArray(value)) value.forEach((v) => Redact.walk(v, "", names));
    else if (value && typeof value === "object") Object.entries(value).forEach(([k, v]) => Redact.walk(v, k, names));
  }
}
