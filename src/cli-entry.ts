import axios from "axios";
import { CliPatch } from "./CliPatch.ts";

CliPatch.install(axios, JSON.parse(process.env.DOKPLOY_EXTRA_HEADERS || "{}"));
await import("@dokploy/cli/dist/index.js");
