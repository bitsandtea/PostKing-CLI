import { createClient } from "../client";
import { extractApiError } from "../api-error";

export async function userCreditsCommand(options: { json?: boolean } = {}): Promise<void> {
  const client = createClient();

  try {
    const res = await client.get("/api/user/credits");
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    const { credits } = res.data;

    console.log("\n" + "=".repeat(32));
    console.log(`YOUR CREDITS: ${credits}`);
    console.log("=".repeat(32) + "\n");

    if (credits < 50) {
      console.log("💡 Tip: You can top up your credits at postking.app/billing\n");
    }
  } catch (err: any) {
    console.error(`\n❌ ERROR: ${extractApiError(err)}\n`);
    process.exit(1);
  }
}
