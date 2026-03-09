"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userCreditsCommand = userCreditsCommand;
const client_1 = require("../client");
async function userCreditsCommand() {
    const client = (0, client_1.createClient)();
    try {
        const res = await client.get("/api/user/credits");
        const { credits } = res.data;
        console.log("\n" + "=".repeat(32));
        console.log(`YOUR CREDITS: ${credits}`);
        console.log("=".repeat(32) + "\n");
        if (credits < 50) {
            console.log("💡 Tip: You can top up your credits at postking.app/billing\n");
        }
    }
    catch (err) {
        console.error(`\n❌ ERROR: ${err.response?.data?.error || err.message}\n`);
        process.exit(1);
    }
}
