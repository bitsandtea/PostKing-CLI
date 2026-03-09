"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.editorRewriteCommand = editorRewriteCommand;
exports.editorHumanizeCommand = editorHumanizeCommand;
exports.editorAICheckCommand = editorAICheckCommand;
const client_1 = require("../client");
const config_1 = require("../config");
async function editorRewriteCommand(options) {
    const client = (0, client_1.createClient)();
    const brandId = (0, config_1.getBrandId)();
    if (!brandId) {
        console.error("ERROR: No active brand selected.");
        process.exit(1);
    }
    console.log(`\n✍️  Rewriting content${options.voice ? ` using voice profile: ${options.voice}` : " using core writing rules"}...`);
    try {
        const platform = options.platform?.toLowerCase();
        const isCustomLength = platform?.startsWith("custom:");
        const customLimit = isCustomLength ? parseInt(platform.split(":")[1], 10) : undefined;
        const res = await client.post(`/api/brands/${brandId}/rewrite`, {
            text: options.text,
            voiceId: options.voice,
            platform: isCustomLength ? "custom" : options.platform,
            customCharLimit: customLimit,
        });
        console.log("\n✅ REWRITTEN CONTENT:");
        console.log("------------------------------------------");
        console.log(res.data.rewrittenText);
        console.log("------------------------------------------\n");
    }
    catch (err) {
        console.error("❌ ERROR: Rewrite failed.");
        if (err.response?.data?.error) {
            console.error(`Reason: ${err.response.data.error}`);
        }
        else if (err.code === "ECONNABORTED") {
            console.error("Reason: Request timed out. This can happen with deep voice generation.");
        }
        else {
            console.error(`Reason: ${err.message || "Unknown error"}`);
        }
        process.exit(1);
    }
}
async function editorHumanizeCommand(options) {
    const client = (0, client_1.createClient)();
    const brandId = (0, config_1.getBrandId)();
    if (!brandId) {
        console.error("ERROR: No active brand selected.");
        process.exit(1);
    }
    console.log("\n🧠 Getting rid of AI Slop...");
    try {
        const platform = options.platform?.toLowerCase();
        const isCustomLength = platform?.startsWith("custom:");
        const customLimit = isCustomLength ? parseInt(platform.split(":")[1], 10) : undefined;
        const res = await client.post(`/api/brands/${brandId}/humanize`, {
            text: options.text,
            options: {
                platform: isCustomLength ? "custom" : options.platform,
                customCharLimit: customLimit
            }
        });
        console.log("\n✨ HUMANIZED CONTENT:");
        console.log("------------------------------------------");
        console.log(res.data.processedText);
        console.log("------------------------------------------");
        console.log("");
    }
    catch (err) {
        console.error("❌ ERROR: Humanization failed.");
        if (err.response?.data?.error) {
            console.error(`Reason: ${err.response.data.error}`);
        }
        else if (err.code === "ECONNABORTED") {
            console.error("Reason: Request timed out. This can happen with deep voice generation.");
        }
        else {
            console.error(`Reason: ${err.message || "Unknown error"}`);
        }
        process.exit(1);
    }
}
async function editorAICheckCommand(options) {
    const brandId = (0, config_1.getBrandId)();
    if (!brandId) {
        console.error("ERROR: No active brand selected.");
        process.exit(1);
    }
    console.log("\n🔍 Analyzing content for AI signatures...");
    try {
        const aiDetectionUrl = (0, config_1.getAiDetectionUrl)();
        console.log("AI detection url: ", aiDetectionUrl);
        const response = await fetch(aiDetectionUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ inputs: options.text }),
        });
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`AI Detection service failed: ${response.statusText} - ${errorBody}`);
        }
        const data = await response.json();
        let results;
        if (Array.isArray(data) && Array.isArray(data[0])) {
            results = data[0];
        }
        else if (Array.isArray(data)) {
            results = data;
        }
        else {
            results = [data];
        }
        const sorted = [...results].sort((a, b) => b.score - a.score);
        const top = sorted[0];
        const isFake = top.label === "Fake";
        const fakeResult = results.find((r) => r.label === "Fake");
        const realResult = results.find((r) => r.label === "Real");
        const aiProb = fakeResult ? (fakeResult.score * 100).toFixed(1) : "0.0";
        const humanProb = realResult ? (realResult.score * 100).toFixed(1) : "0.0";
        console.log("\n📊 DETECTION RESULT:");
        console.log("------------------------------------------");
        if (isFake) {
            console.log(`Verdict: \x1b[31mAI GENERATED\x1b[0m (${aiProb}% probability)`);
        }
        else {
            console.log(`Verdict: \x1b[32mLIKELY HUMAN\x1b[0m (${humanProb}% human probability)`);
        }
        console.log("\nRaw Probabilities:");
        console.log(`  - Fake: ${aiProb}%`);
        console.log(`  - Real: ${humanProb}%`);
        console.log("------------------------------------------\n");
    }
    catch (err) {
        console.error("❌ ERROR: AI Check failed.");
        console.error(err.message || err);
        process.exit(1);
    }
}
