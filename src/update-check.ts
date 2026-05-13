import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import axios from "axios";

const CACHE_DIR = path.join(os.homedir(), ".postking");
const CACHE_FILE = path.join(CACHE_DIR, "version-cache.json");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const REGISTRY_URL = "https://registry.npmjs.org/postking-cli/latest";
const FETCH_TIMEOUT_MS = 2000;

interface VersionCache {
  checkedAt: number;
  latest: string;
}

function isNewerVersion(latest: string, current: string): boolean {
  const latestParts = latest.split(".").map(Number);
  const currentParts = current.split(".").map(Number);
  const len = Math.max(latestParts.length, currentParts.length);
  for (let i = 0; i < len; i++) {
    const l = latestParts[i] ?? 0;
    const c = currentParts[i] ?? 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
}

function readCache(): VersionCache | null {
  try {
    const raw = fs.readFileSync(CACHE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (typeof parsed.checkedAt === "number" && typeof parsed.latest === "string") {
      return parsed as VersionCache;
    }
    return null;
  } catch {
    return null;
  }
}

function writeCache(latest: string): void {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ checkedAt: Date.now(), latest }), "utf8");
  } catch {
    // best-effort, suppress errors
  }
}

function printUpdateWarning(latest: string, current: string): void {
  process.stderr.write(
    `\x1b[33m⚠  postking-cli ${latest} is available (you have ${current}). Run: npm i -g postking-cli@latest\x1b[0m\n`
  );
}

export function runUpdateCheck(currentVersion: string): void {
  try {
    const cache = readCache();
    const now = Date.now();

    if (cache && now - cache.checkedAt < CACHE_TTL_MS) {
      // Cache is fresh — just check if we should warn
      if (isNewerVersion(cache.latest, currentVersion)) {
        printUpdateWarning(cache.latest, currentVersion);
      }
      return;
    }

    // Cache is stale or missing — fire-and-forget fetch
    axios
      .get(REGISTRY_URL, { timeout: FETCH_TIMEOUT_MS })
      .then((res) => {
        const latest = res.data?.version;
        if (typeof latest === "string") {
          writeCache(latest);
        }
      })
      .catch(() => {
        // best-effort, suppress all errors
      });
  } catch {
    // best-effort, suppress all errors
  }
}
