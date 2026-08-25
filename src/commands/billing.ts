import axios from "axios";
import { createClient } from "../client";
import { extractApiError } from "../api-error";
import { tickLine } from "../lib/ttyOutput";

const VALID_PACK_SKUS = ["agent_4", "agent_5", "agent_25", "agent_50"];
const VALID_TIERS = ["GROWTH", "PRO", "ENTERPRISE"];
const VALID_INTERVALS = ["month", "year"];
const POLL_INTERVAL_MS = 3000;
const POLL_MAX_MS = 300_000; // 5 minutes

// ─── 402 INSUFFICIENT_AGENT_CREDITS envelope ──────────────────────────────────

interface BillingErrorEnvelope {
  code: string;
  message: string;
  retryable?: boolean;
  packs?: Array<{ sku: string; priceUsd: number; credits: number }>;
  topupEndpoint?: string;
  subscribeEndpoint?: string;
}

function printBillingError(err: unknown): void {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as Record<string, unknown> | undefined;
    const env = data?.error as BillingErrorEnvelope | undefined;
    if (env && typeof env === "object") {
      console.error(`ERROR: ${env.code ?? "BILLING_ERROR"}: ${env.message}`);
      if (env.packs && Array.isArray(env.packs)) {
        console.error("Available packs:");
        for (const pack of env.packs) {
          console.error(`  ${pack.sku}  $${pack.priceUsd}  ${pack.credits} credits`);
        }
      }
      if (env.topupEndpoint) {
        console.error(`Top up: ${env.topupEndpoint}`);
      }
      if (env.subscribeEndpoint) {
        console.error(`Subscribe: ${env.subscribeEndpoint}`);
      }
      return;
    }
  }
  console.error(`ERROR: ${extractApiError(err)}`);
}

// ─── Shared response types ────────────────────────────────────────────────────

interface Pack {
  sku: string;
  priceUsd: number;
  credits: number;
}

interface WalletRow {
  delta: number;
  balanceAfter: number;
  reason: string;
  stripeSessionId?: string | null;
  createdAt: string;
}

interface WalletResponse {
  agentCredits: number;
  recent: WalletRow[];
}

interface MeResponse {
  billingMode: string | null;
  subscriptionTier: string | null;
  [key: string]: unknown;
}

// ─── billingPacksCommand ──────────────────────────────────────────────────────

export async function billingPacksCommand(options: { json?: boolean } = {}): Promise<void> {
  const client = createClient();
  try {
    const res = await client.get("/api/agent/v1/billing/packs");
    if (options.json) {
      console.log(JSON.stringify(res.data, null, 2));
      return;
    }
    const { packs } = res.data as { packs: Pack[] };
    console.log("\n=== Credit Packs ===");
    console.log("SKU              Price         Credits");
    console.log("──────────────────────────────────────");
    for (const pack of packs) {
      console.log(
        `${pack.sku.padEnd(16)} $${String(pack.priceUsd).padEnd(12)} ${pack.credits}`
      );
    }
    console.log("");
  } catch (err) {
    printBillingError(err);
    process.exit(1);
  }
}

// ─── billingTopupCommand ──────────────────────────────────────────────────────

interface TopupPaidResponse {
  status: "paid";
  paymentIntentId: string;
  amountUsd: number;
  credits: number;
  balance: number;
  packSku: string;
  cardLast4?: string;
  receiptUrl?: string;
}

interface TopupCheckoutResponse {
  checkoutUrl: string;
  sessionId: string;
  amountUsd: number;
  credits: number;
  packSku: string;
}

type TopupResponse = TopupPaidResponse | TopupCheckoutResponse;

export async function billingTopupCommand(options: { pack: string; json?: boolean }): Promise<void> {
  if (!VALID_PACK_SKUS.includes(options.pack)) {
    console.error(
      `ERROR: Invalid pack SKU "${options.pack}". Valid options: ${VALID_PACK_SKUS.join(", ")}`
    );
    process.exit(1);
  }

  const client = createClient();

  let topupData: TopupResponse;
  try {
    const res = await client.post("/api/agent/v1/billing/topup", { packSku: options.pack });
    topupData = res.data as TopupResponse;
  } catch (err) {
    printBillingError(err);
    process.exit(1);
    return;
  }

  // Headless paid path — card was charged synchronously, no poll needed.
  if ("status" in topupData && topupData.status === "paid") {
    if (options.json) {
      console.log(JSON.stringify(topupData, null, 2));
      return;
    }
    const cardSuffix = topupData.cardLast4 ? ` · Visa ····${topupData.cardLast4}` : "";
    console.log(
      `\nSUCCESS: Payment succeeded — ${topupData.paymentIntentId}${cardSuffix} · ${topupData.credits} credits added · balance ${topupData.balance}`
    );
    if (topupData.receiptUrl) {
      console.log(`Receipt:    ${topupData.receiptUrl}`);
    }
    return;
  }

  // Checkout fallback — no card on file; direct user to the link.
  const checkout = topupData as TopupCheckoutResponse;

  if (!options.json) {
    console.log("\n=== Checkout Initiated ===");
    console.log(`Pack:       ${checkout.packSku}`);
    console.log(`Amount:     $${checkout.amountUsd}`);
    console.log(`Credits:    ${checkout.credits}`);
    console.log(`Session:    ${checkout.sessionId}`);
    console.log(`Checkout:   ${checkout.checkoutUrl}`);
    console.log("");
    console.log("Waiting for payment confirmation (up to 5 min)...");
  }

  // Poll wallet until a ledger row with this exact session id appears or timeout.
  // Matching on stripeSessionId (set by the Stripe webhook on the AGENT_TOPUP row)
  // is authoritative — it confirms THIS top-up was granted, not a coincidental
  // balance change from a prior or concurrent transaction.
  const sessionId = checkout.sessionId;
  const deadline = Date.now() + POLL_MAX_MS;
  let finalWallet: WalletResponse | null = null;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    try {
      const pollRes = await client.get("/api/agent/v1/billing/wallet");
      const pollData = pollRes.data as WalletResponse;
      if (!options.json) {
        tickLine(`Polling... current balance: ${pollData.agentCredits} credits`);
      }
      if (pollData.recent.some((row) => row.stripeSessionId === sessionId)) {
        finalWallet = pollData;
        break;
      }
    } catch {
      // Non-fatal — keep polling
    }
  }

  if (options.json) {
    if (finalWallet) {
      console.log(JSON.stringify({ ...checkout, finalWallet }, null, 2));
    } else {
      console.log(JSON.stringify(checkout, null, 2));
    }
    return;
  }

  if (finalWallet) {
    console.log(
      `\nSUCCESS: Payment confirmed. New balance: ${finalWallet.agentCredits} credits`
    );
  } else {
    console.log(
      "\nWARNING: Timed out waiting for payment confirmation. Your payment may still process — check balance with 'pking billing wallet'."
    );
  }
}

// ─── billingWalletCommand ─────────────────────────────────────────────────────

export async function billingWalletCommand(options: { json?: boolean } = {}): Promise<void> {
  const client = createClient();
  try {
    const res = await client.get("/api/agent/v1/billing/wallet");
    if (options.json) {
      console.log(JSON.stringify(res.data, null, 2));
      return;
    }
    const { agentCredits, recent } = res.data as WalletResponse;
    console.log("\n=== Wallet ===");
    console.log(`Balance: ${agentCredits} credits`);
    if (recent && recent.length > 0) {
      console.log("\nRecent Transactions:");
      console.log("Delta        Balance After  Reason                           Created At");
      console.log("────────────────────────────────────────────────────────────────────────");
      for (const row of recent) {
        const delta = (row.delta >= 0 ? "+" : "") + String(row.delta);
        console.log(
          `${delta.padEnd(12)} ${String(row.balanceAfter).padEnd(14)} ${(row.reason ?? "").padEnd(33)} ${row.createdAt}`
        );
      }
    }
    console.log("");
  } catch (err) {
    printBillingError(err);
    process.exit(1);
  }
}

// ─── billingTiersCommand ──────────────────────────────────────────────────────

interface Tier {
  tier: string;
  name: string;
  priceUsd: number;
  monthlyCredits: number;
  intervals: string[];
}

export async function billingTiersCommand(options: { json?: boolean } = {}): Promise<void> {
  const client = createClient();
  try {
    const res = await client.get("/api/agent/v1/billing/tiers");
    if (options.json) {
      console.log(JSON.stringify(res.data, null, 2));
      return;
    }
    const { tiers } = res.data as { tiers: Tier[] };
    console.log("\n=== Subscription Tiers ===");
    console.log(
      "Tier            Name            Price         Credits/mo   Intervals"
    );
    console.log(
      "───────────────────────────────────────────────────────────────────────"
    );
    for (const t of tiers) {
      console.log(
        `${t.tier.padEnd(16)}${(t.name ?? "").padEnd(16)}$${String(t.priceUsd ?? "—").padEnd(13)}${String(t.monthlyCredits ?? "—").padEnd(13)}${(t.intervals ?? []).join(", ")}`
      );
    }
    console.log("");
  } catch (err) {
    printBillingError(err);
    process.exit(1);
  }
}

// ─── billingSubscribeCommand ──────────────────────────────────────────────────

interface SubscribeResponse {
  checkoutUrl: string;
  sessionId: string;
  tier: string;
  interval: string;
  amountUsd: number | null;
}

export async function billingSubscribeCommand(options: {
  tier: string;
  interval?: string;
  json?: boolean;
}): Promise<void> {
  if (!VALID_TIERS.includes(options.tier)) {
    console.error(
      `ERROR: Invalid tier "${options.tier}". Valid options: ${VALID_TIERS.join(", ")}`
    );
    process.exit(1);
  }

  const interval = options.interval ?? "month";
  if (!VALID_INTERVALS.includes(interval)) {
    console.error(
      `ERROR: Invalid interval "${interval}". Valid options: ${VALID_INTERVALS.join(", ")}`
    );
    process.exit(1);
  }

  const client = createClient();

  let subscribeData: SubscribeResponse;
  try {
    const res = await client.post("/api/agent/v1/billing/subscribe", {
      tier: options.tier,
      interval,
    });
    subscribeData = res.data as SubscribeResponse;
  } catch (err) {
    printBillingError(err);
    process.exit(1);
    return;
  }

  const amountDisplay =
    subscribeData.amountUsd != null
      ? `$${subscribeData.amountUsd}`
      : "(annual — contact for pricing)";

  if (!options.json) {
    console.log("\n=== Subscription Checkout ===");
    console.log(`Tier:       ${subscribeData.tier}`);
    console.log(`Interval:   ${subscribeData.interval}`);
    console.log(`Amount:     ${amountDisplay}`);
    console.log(`Session:    ${subscribeData.sessionId}`);
    console.log(`Checkout:   ${subscribeData.checkoutUrl}`);
    console.log("");
    console.log("Waiting for subscription confirmation (up to 5 min)...");
  }

  // Poll /me until billingMode === "subscription" or timeout
  const deadline = Date.now() + POLL_MAX_MS;
  let finalMe: MeResponse | null = null;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    try {
      const pollRes = await client.get("/api/agent/v1/me");
      const pollData = pollRes.data as MeResponse;
      if (!options.json) {
        tickLine(`Polling... billing mode: ${pollData.billingMode ?? "prepaid"}`);
      }
      if (pollData.billingMode === "subscription") {
        finalMe = pollData;
        break;
      }
    } catch {
      // Non-fatal — keep polling
    }
  }

  if (options.json) {
    if (finalMe) {
      console.log(JSON.stringify({ ...subscribeData, me: finalMe }, null, 2));
    } else {
      console.log(JSON.stringify(subscribeData, null, 2));
    }
    return;
  }

  if (finalMe) {
    console.log(
      `\nSUCCESS: Subscription activated. Tier: ${finalMe.subscriptionTier ?? subscribeData.tier}`
    );
  } else {
    console.log(
      "\nWARNING: Timed out waiting for subscription confirmation. Your payment may still process — check status with 'pking me'."
    );
  }
}
