const DOTENV = /(env|buildArgs|buildSecrets)$/i;
const SECRET = /(password|secret|token|key)$/i;

// For the job log only: dotenv blobs become `NAME: ok`, secret-looking fields `***`. `result` stays raw.
export function redact(value: unknown, key = ""): unknown {
  if (typeof value === "string" && value) {
    if (DOTENV.test(key)) {
      return value
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"))
        .map((l) => `${l.split("=")[0].trim()}: ok`);
    }
    if (SECRET.test(key)) return "***";
  }
  if (Array.isArray(value)) return value.map((v) => redact(v));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redact(v, k)]));
  }
  return value;
}
