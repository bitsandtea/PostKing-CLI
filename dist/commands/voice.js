"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.voiceListCommand = voiceListCommand;
exports.voiceRewriteCommand = voiceRewriteCommand;
const client_1 = require("../client");
const config_1 = require("../config");
async function voiceListCommand() {
    const client = (0, client_1.createClient)();
    try {
        // Fetch public profiles (no auth required) and brand-specific profiles
        const res = await client.get("/api/voice-profiles/public");
        const profiles = res.data.profiles || [];
        if (profiles.length === 0) {
            console.log("No public voice profiles available.");
            return;
        }
        console.log(`Available voice profiles (${profiles.length}):\n`);
        profiles.forEach((p) => {
            const label = p.name || p.authorName || "Unnamed";
            const deepLabel = p.modalAdapterId ? " [DEEP VOICE]" : "";
            console.log(`  ID:     ${p.id}`);
            console.log(`  Name:   ${label}${deepLabel}`);
            console.log("");
        });
    }
    catch (err) {
        process.exit(1);
    }
}
async function voiceRewriteCommand(options) {
    const client = (0, client_1.createClient)();
    const brandId = (0, config_1.getBrandId)();
    if (!brandId) {
        console.error("ERROR: No active brand selected.");
        console.error("Run 'pking brand set <brand_id>' first.");
        process.exit(1);
    }
    const platform = options.platform?.toLowerCase() || "x";
    const isCustomLength = platform.startsWith("custom:");
    const customLimit = isCustomLength ? parseInt(platform.split(":")[1], 10) : undefined;
    try {
        const res = await client.post(`/api/brands/${brandId}/repurpose`, {
            sourceType: "text",
            sourceContent: options.text,
            targetType: isCustomLength ? "text" : "social",
            targetPlatforms: isCustomLength ? undefined : [platform],
            textLength: isCustomLength ? "custom" : undefined,
            textCustomWordCount: customLimit,
            variationCount: 1,
            voiceProfileIds: {
                [platform]: options.profileId,
                text: options.profileId,
            },
        });
        const data = res.data;
        const posts = data.posts || data.results || [];
        if (posts.length > 0) {
            console.log("REWRITTEN TEXT:\n");
            posts.forEach((p, i) => {
                if (posts.length > 1)
                    console.log(`--- Variation ${i + 1} ---`);
                console.log(p.content || p.text || JSON.stringify(p));
                console.log("");
            });
        }
        else {
            // Fallback: print raw response
            console.log("RESULT:");
            console.log(JSON.stringify(data, null, 2));
        }
    }
    catch (err) {
        process.exit(1);
    }
}
