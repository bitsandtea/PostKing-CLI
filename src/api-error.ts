import axios from "axios";

export function extractApiError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as Record<string, unknown> | undefined;
    const envelope = data?.error;
    if (envelope && typeof envelope === "object") {
      const e = envelope as Record<string, unknown>;
      const msg = typeof e.message === "string" ? e.message : undefined;
      const code = typeof e.code === "string" ? e.code : undefined;
      if (msg) return code ? `${code}: ${msg}` : msg;
    }
    if (typeof envelope === "string" && envelope) return envelope;
    if (typeof data?.message === "string" && data.message) return data.message;
    return err.message;
  }
  return String(err);
}
