import { parse } from "yaml";

const ID_FIELDS: Record<string, string> = { compose: "composeId", application: "applicationId" };

export class Command {
  readonly path: string[];
  readonly group: string;
  readonly idField: string | undefined;
  readonly isDeploy: boolean;
  private readonly args: Record<string, unknown>;

  constructor(command: string, args: Record<string, unknown>) {
    this.path = command.split(/\s+/).filter(Boolean);
    this.group = this.path[0] ?? "";
    this.idField = ID_FIELDS[this.group];
    this.isDeploy = this.idField !== undefined && ["deploy", "redeploy"].includes(this.path[1]);
    this.args = args;
  }

  // JSON or a YAML mapping. The error never quotes the input: it may hold secrets.
  static parseObject(name: string, raw: string): Record<string, unknown> {
    if (!raw.trim()) return {};
    let value: unknown;
    try {
      value = parse(raw);
    } catch {
      throw new Error(`\`${name}\` is not valid JSON or YAML`);
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`\`${name}\` must be an object`);
    return value as Record<string, unknown>;
  }

  get id(): string | undefined {
    const v = this.idField && this.args[this.idField];
    return v ? String(v) : undefined;
  }

  withId(id: string): Command {
    return new Command(this.path.join(" "), { ...this.args, [this.idField!]: id });
  }

  // true adds a bare flag, false/null drops it
  argv(): string[] {
    const flags = Object.entries(this.args).flatMap(([k, v]) =>
      v === true ? [`--${k}`] : v === false || v == null ? [] : [`--${k}`, typeof v === "object" ? JSON.stringify(v) : String(v)],
    );
    return [...this.path, ...flags];
  }
}
