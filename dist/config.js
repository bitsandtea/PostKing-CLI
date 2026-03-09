"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfig = getConfig;
exports.setConfig = setConfig;
exports.clearConfig = clearConfig;
exports.getApiKey = getApiKey;
exports.getApiUrl = getApiUrl;
exports.getBrandId = getBrandId;
exports.getAiDetectionUrl = getAiDetectionUrl;
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const constants_1 = require("./constants");
const CONFIG_DIR = path_1.default.join(os_1.default.homedir(), ".pking");
const CONFIG_FILE = path_1.default.join(CONFIG_DIR, "config.json");
function readConfig() {
    try {
        if (fs_1.default.existsSync(CONFIG_FILE)) {
            return JSON.parse(fs_1.default.readFileSync(CONFIG_FILE, "utf-8"));
        }
    }
    catch {
        // Ignore parse errors
    }
    return {};
}
function writeConfig(config) {
    fs_1.default.mkdirSync(CONFIG_DIR, { recursive: true });
    fs_1.default.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}
function getConfig() {
    return readConfig();
}
function setConfig(updates) {
    const current = readConfig();
    writeConfig({ ...current, ...updates });
}
function clearConfig() {
    writeConfig({});
}
function getApiKey() {
    return readConfig().apiKey;
}
function getApiUrl() {
    return readConfig().apiUrl || constants_1.DEFAULT_API_URL;
}
function getBrandId() {
    return readConfig().brandId;
}
function getAiDetectionUrl() {
    return constants_1.DEFAULT_AI_DETECTION_URL;
}
