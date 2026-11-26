import { parse } from "dotenv";

// For the job log only: dotenv blobs become `NAME: ok`, secret-looking fields `***`. `result` stays raw.
export class Redact {
  private static readonly DOTENV = /(env|buildArgs|buildSecrets)$/i;
  private static readonly SECRET = /(password|secret|token|key)$/i;

  static json(value: unknown): unknown {
    return Redact.walk(value, "");
  }

  private static walk(value: unknown, key: string): unknown {
    if (typeof value === "string" && value) {
      if (Redact.DOTENV.test(key)) return Object.keys(parse(value)).map((name) => `${name}: ok`);
      if (Redact.SECRET.test(key)) return "***";
    }
    if (Array.isArray(value)) return value.map((v) => Redact.walk(v, key));
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, Redact.walk(v, k)]));
    }
    return value;
  }
}
