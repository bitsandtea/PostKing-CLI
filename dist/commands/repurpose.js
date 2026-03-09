"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.repurposeCommand = repurposeCommand;
const client_1 = require("../client");
const config_1 = require("../config");
async function repurposeCommand(options) {
    const client = (0, client_1.createClient)();
    const brandId = (0, config_1.getBrandId)();
    if (!brandId) {
        console.error("ERROR: No active brand selected.");
        process.exit(1);
    }
    // Build payload
    const payload = {
        sourceType: options.sourceType,
        targetType: options.targetType,
    };
    if (options.sourceContent)
        payload.sourceContent = options.sourceContent;
    if (options.sourceBlog)
        payload.sourceBlogId = options.sourceBlog;
    if (options.sourceUrl)
        payload.sourceUrl = options.sourceUrl;
    if (options.sourcePost)
        payload.sourcePostId = options.sourcePost;
    if (options.targetPlatforms) {
        payload.targetPlatforms = options.targetPlatforms.split(",").map((p) => p.trim());
    }
    if (options.variations)
        payload.variationCount = parseInt(options.variations, 10);
    if (options.specificGoal)
        payload.specificGoal = options.specificGoal;
    if (options.angle)
        payload.angle = options.angle;
    if (options.themeId)
        payload.themeId = options.themeId;
    if (options.includeLink)
        payload.includeLink = true;
    if (options.textLength) {
        if (options.textLength.startsWith("custom:")) {
            payload.textLength = "custom";
            payload.textCustomWordCount = parseInt(options.textLength.split(":")[1], 10);
        }
        else {
            payload.textLength = options.textLength;
        }
    }
    if (options.voice) {
        const voiceProfileIds = {};
        if (options.voice.includes(":")) {
            const parts = options.voice.split(",");
            parts.forEach((p) => {
                const [plat, id] = p.split(":");
                if (plat && id)
                    voiceProfileIds[plat.trim()] = id.trim();
            });
        }
        else {
            // Apply to all target platforms, or 'text' if text target, or default platforms
            const platforms = payload.targetPlatforms || ["x", "linkedin", "facebook", "threads", "text", "blog"];
            platforms.forEach((p) => {
                voiceProfileIds[p] = options.voice.trim();
            });
        }
        payload.voiceProfileIds = voiceProfileIds;
    }
    console.log(`\n🔄 Repurposing ${options.sourceType} to ${options.targetType}...`);
    try {
        const res = await client.post(`/api/brands/${brandId}/repurpose`, payload);
        const data = res.data;
        console.log("\n✅ REPURPOSE SUCCESS!\n");
        if (data.variations) {
            Object.entries(data.variations).forEach(([platform, variations]) => {
                console.log(`--- Platform: ${platform.toUpperCase()} ---`);
                if (Array.isArray(variations)) {
                    variations.forEach((v, i) => {
                        console.log(`Variation ${i + 1}:`);
                        console.log(v.content || v.text);
                        console.log();
                    });
                }
                else if (typeof variations === 'object' && variations !== null) {
                    console.log(variations.content || variations);
                    console.log();
                }
                else {
                    console.log(variations);
                    console.log();
                }
            });
        }
        if (data.saved) {
            if (data.saved.posts && data.saved.posts.length > 0) {
                console.log(`Saved ${data.saved.posts.length} posts as drafts.`);
            }
            if (data.saved.blog) {
                console.log(`Saved blog document: ${data.saved.blog.id}`);
            }
        }
    }
    catch (err) {
        console.error("❌ ERROR: Repurpose failed.");
        if (err.response?.data?.error || err.response?.data?.message) {
            console.error(`Reason: ${err.response.data.error || err.response.data.message}`);
        }
        else {
            console.error(`Reason: ${err.message || "Unknown error"}`);
        }
        process.exit(1);
    }
}
