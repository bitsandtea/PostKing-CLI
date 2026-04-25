import axios, { AxiosInstance } from "axios";
import { getApiKey, getApiUrl } from "./config";
import { REQUEST_TIMEOUT_MS } from "./constants";

export function createClient(): AxiosInstance {
  const apiKey = getApiKey();
  const baseURL = getApiUrl();

  if (!apiKey) {
    console.error("ERROR: Not authenticated. Run 'pking login' first.");
    process.exit(1);
  }

  const client = axios.create({
    baseURL,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
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
    (res) => res,
    (error) => {
      if (error.response) {
        const { status, data } = error.response;
        // v0.1 uniform agent error envelope
        const envelope = data?.error;
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
          console.error("ERROR 401: Invalid or expired API key. Run 'pking login' to re-authenticate.");
        }
      } else if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
        console.error("ERROR: Cannot reach PostKing API. Check your internet connection.");
      }

      return Promise.reject(error);
    }
  );

  return client;
}
