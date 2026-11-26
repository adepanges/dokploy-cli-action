export type Deploy = { group: "compose" | "application"; id: "composeId" | "applicationId" };

// `--flag value` lines or a JSON object; true means a bare flag
export function parseArgs(raw: string): string[] {
  const text = raw.trim();
  if (!text) return [];
  if (text.startsWith("{")) {
    return Object.entries(JSON.parse(text) as Record<string, unknown>).flatMap(([k, v]) =>
      v === true ? [`--${k}`] : v === false || v == null ? [] : [`--${k}`, String(v)],
    );
  }
  return text.split("\n").flatMap((line) => {
    const [flag, ...rest] = line.trim().split(/\s+/);
    if (!flag) return [];
    if (!flag.startsWith("--")) throw new Error(`args line must start with --: ${line}`);
    return rest.length ? [flag, rest.join(" ")] : [flag];
  });
}

export function deployTarget(command: string[]): Deploy | undefined {
  const [group, action] = command;
  if (action !== "deploy" && action !== "redeploy") return;
  if (group === "compose") return { group, id: "composeId" };
  if (group === "application") return { group, id: "applicationId" };
}
