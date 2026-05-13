import fs from "fs";
import os from "os";
import path from "path";
import { DEFAULT_API_URL } from "./constants";

const CONFIG_DIR = path.join(os.homedir(), ".pking");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

interface Config {
  apiKey?: string;
  apiUrl?: string;
  brandId?: string;
}

function readConfig(): Config {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
    }
  } catch {
    // Ignore parse errors
  }
  return {};
}

function writeConfig(config: Config): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

export function getConfig(): Config {
  return readConfig();
}

export function setConfig(updates: Partial<Config>): void {
  const current = readConfig();
  writeConfig({ ...current, ...updates });
}

export function clearConfig(): void {
  writeConfig({});
}

export function getApiKey(): string | undefined {
  // Env var wins over stored token — no device flow needed when injected by Hermes.
  return process.env.POSTKING_API_KEY || readConfig().apiKey;
}

/** Returns true when auth comes from the env var rather than the local config file. */
export function isEnvVarAuth(): boolean {
  return !!process.env.POSTKING_API_KEY;
}

export function getApiUrl(): string {
  return readConfig().apiUrl || DEFAULT_API_URL;
}

export function getBrandId(): string | undefined {
  return readConfig().brandId;
}
