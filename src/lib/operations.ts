import type { AxiosInstance } from "axios";

// ─── Operation types ──────────────────────────────────────────────────────────

export interface OperationProgress {
  current?: number;
  total?: number;
  message?: string;
}

export interface OperationError {
  message: string;
}

export interface Operation {
  id: string;
  kind?: string;
  state: string;
  progress: OperationProgress | null;
  result: unknown;
  errors: OperationError[];
  startedAt?: string;
  finishedAt?: string;
}

// ─── pollOperation ────────────────────────────────────────────────────────────

export async function pollOperation(
  client: AxiosInstance,
  brandId: string,
  operationId: string,
  opts?: { label?: string }
): Promise<Operation> {
  const POLL_INTERVAL = 3000;
  const TIMEOUT = 600000;
  const label = opts?.label ?? "Operation";
  const startTime = Date.now();

  console.log(`${label}: ${operationId} (polling…)`);

  while (true) {
    if (Date.now() - startTime > TIMEOUT) {
      console.warn(`TIMEOUT: ${label} is still running after 10 minutes.`);
      console.warn(`Check it later with operationId: ${operationId}`);
      process.exit(1);
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));

    let op: Operation;
    try {
      const res = await client.get(
        `/api/agent/v1/brands/${brandId}/operations/${operationId}`
      );
      op = res.data as Operation;
    } catch (err) {
      const e = err as { response?: { data?: { error?: { message?: string; checkoutUrl?: string } } }; message: string };
      const env = e.response?.data?.error;
      console.error(`ERROR: ${env?.message ?? e.message}`);
      if (env?.checkoutUrl) console.error(`-> Upgrade: ${env.checkoutUrl}`);
      process.exit(1);
    }

    const progress = op.progress;
    if (progress?.message) {
      const prefix =
        progress.current !== undefined && progress.total !== undefined
          ? `[${progress.current}/${progress.total}] `
          : "";
      process.stdout.write(`\r  ${prefix}${progress.message}                    `);
    }

    const terminal = ["completed", "partially_failed", "failed", "cancelled"];
    if (!terminal.includes(op.state)) {
      continue;
    }

    // Terminal — clear the progress line
    process.stdout.write("\n");

    if (op.state === "completed") {
      console.log(`SUCCESS: ${label} completed.`);
      if (op.result) console.log(JSON.stringify(op.result, null, 2));
      return op;
    }

    if (op.state === "partially_failed") {
      console.warn(`WARNING: ${label} partially failed.`);
      op.errors.forEach((e) => console.warn(`  - ${e.message}`));
      return op;
    }

    // failed or cancelled
    console.error(`ERROR: ${label} ${op.state}.`);
    op.errors.forEach((e) => console.error(`  - ${e.message}`));
    process.exit(1);
  }
}
