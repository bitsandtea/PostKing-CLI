import axios, { AxiosInstance } from "axios";
import * as os from "os";
import { getApiKey, getApiUrl, isEnvVarAuth } from "./config";
import { REQUEST_TIMEOUT_MS } from "./constants";
import { formatInsufficientCreditsLines, PendingConfirmation } from "./api-error";

const pkg = require("../package.json");
export const USER_AGENT = `postking-cli/${pkg.version} ${process.version} ${os.platform()}`;

export function createClient(): AxiosInstance {
  const apiKey = getApiKey();
  const baseURL = getApiUrl();

  if (!apiKey) {
    console.error("Not authenticated. Run `pking login` to authorize this device.");
    process.exit(1);
  }

  const client = axios.create({
    baseURL,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "User-Agent": USER_AGENT,
    },
    timeout: REQUEST_TIMEOUT_MS,
    // Support local self-signed certs if testing against localhost
    ...(baseURL.includes("localhost") || baseURL.includes("127.0.0.1") ? {
      httpsAgent: new (require('https')).Agent({
        rejectUnauthorized: false
      })
    } : {})
  });

  client.interceptors.response.use(
    (res) => {
      // Email-confirmed delete: the server did NOT delete yet. Not an error and
      // must not be retried; the top-level handler prints it and exits 0.
      if (res.status === 202 && res.data?.status === "pending_email_confirmation") {
        throw new PendingConfirmation(res.data);
      }
      return res;
    },
    (error) => {
      if (error.response) {
        const { status, data } = error.response;
        if (status === 426) {
          const minimum = data?.minimum ?? "unknown";
          const yours = data?.yours ?? pkg.version;
          const upgrade = data?.upgrade ?? "npm i -g postking-cli@latest";
          console.error(`✗ Your postking-cli is too old. Server requires ${minimum}; you have ${yours}.`);
          console.error(`  Upgrade: ${upgrade}`);
          process.exit(2);
        }
        // v0.1 uniform agent error envelope
        const envelope = data?.error;
        // 402 insufficient_credits: not an auth failure. Say what it costs and
        // how to top up, then exit 2 (docs/134 §4.2).
        const creditLines = status === 402 ? formatInsufficientCreditsLines(envelope, baseURL) : null;
        if (creditLines) {
          for (const line of creditLines) console.error(line);
          process.exit(2);
        }
        if (envelope && typeof envelope === "object") {
          const code = envelope.code ?? "ERROR";
          const message = envelope.message ?? "(no message)";
          console.error(`ERROR ${status} ${code}: ${message}`);
          if (envelope.checkoutUrl) {
            console.error(`-> Upgrade: ${envelope.checkoutUrl}`);
          }
          if (envelope.docsUrl) {
            console.error(`-> Docs: ${envelope.docsUrl}`);
          }
        } else if (status === 402) {
          console.error("ERROR 402: Insufficient credits or trial expired.");
          const url = data?.checkout_url || data?.billing_url;
          if (url) {
            console.error(`HUMAN_ACTION_REQUIRED: Upgrade at: ${url}`);
          }
        } else if (status === 403) {
          console.error("ERROR 403: Access denied. Your trial may have expired.");
          const url = data?.checkout_url;
          if (url) {
            console.error(`HUMAN_ACTION_REQUIRED: Visit: ${url}`);
          }
        } else if (status === 401) {
          console.error("Not authenticated. Run `pking login` to authorize this device.");
        }
      } else if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
        console.error("ERROR: Cannot reach PostKing API. Check your internet connection.");
      }

      return Promise.reject(error);
    }
  );

  return client;
}
