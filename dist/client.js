"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createClient = createClient;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("./config");
function createClient() {
    const apiKey = (0, config_1.getApiKey)();
    const baseURL = (0, config_1.getApiUrl)();
    if (!apiKey) {
        console.error("ERROR: Not authenticated. Run 'pking login' first.");
        process.exit(1);
    }
    const client = axios_1.default.create({
        baseURL,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        timeout: 120000,
        // Support local self-signed certs if testing against localhost
        ...(baseURL.includes("localhost") || baseURL.includes("127.0.0.1") ? {
            httpsAgent: new (require('https')).Agent({
                rejectUnauthorized: false
            })
        } : {})
    });
    client.interceptors.response.use((res) => res, (error) => {
        if (error.response) {
            const { status, data } = error.response;
            if (status === 402) {
                console.error("ERROR 402: Insufficient credits or trial expired.");
                const url = data?.checkout_url || data?.billing_url;
                if (url) {
                    console.error(`HUMAN_ACTION_REQUIRED: Upgrade at: ${url}`);
                }
            }
            else if (status === 403) {
                console.error("ERROR 403: Access denied. Your trial may have expired.");
                const url = data?.checkout_url;
                if (url) {
                    console.error(`HUMAN_ACTION_REQUIRED: Visit: ${url}`);
                }
            }
            else if (status === 401) {
                console.error("ERROR 401: Invalid or expired API key. Run 'pking login' to re-authenticate.");
            }
        }
        else if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
            console.error("ERROR: Cannot reach PostKing API. Check your internet connection.");
        }
        return Promise.reject(error);
    });
    return client;
}
