/**
 * Asset-upload routing for `pking visuals upload`.
 *
 * Videos and documents go straight to R2 via a presigned URL
 * (upload-url -> PUT -> complete); images and other files keep the base64 JSON
 * POST, capped locally because the server truncates bodies near 10MB.
 */
import path from "path";

/** Raw-byte ceiling for the base64 JSON path (base64 inflates 1.33x; server truncates at 10MB). */
export const MAX_BASE64_PATH_BYTES = 10 * 1024 * 1024;

const VIDEO_EXT_TO_MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".avi": "video/x-msvideo",
  ".m4v": "video/x-m4v",
};

const DOCUMENT_EXT_TO_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
};

export type DirectAssetType = "VIDEO" | "DOCUMENT";

/** Direct-to-R2 type + mime from the file extension, or null when the base64 path applies. */
export function classifyDirectUpload(fileName: string): { type: DirectAssetType; mimeType: string } | null {
  const ext = path.extname(fileName).toLowerCase();
  if (VIDEO_EXT_TO_MIME[ext]) return { type: "VIDEO", mimeType: VIDEO_EXT_TO_MIME[ext] };
  if (DOCUMENT_EXT_TO_MIME[ext]) return { type: "DOCUMENT", mimeType: DOCUMENT_EXT_TO_MIME[ext] };
  return null;
}

export function oversizeBase64Message(byteLength: number): string | null {
  if (byteLength <= MAX_BASE64_PATH_BYTES) return null;
  const mb = (byteLength / (1024 * 1024)).toFixed(1);
  return `File is ${mb}MB, over the 10MB limit for images and other non-video/non-document assets. Resize or compress it. Videos (mp4, webm, mov, avi, m4v; up to 500MB) and documents (pdf, doc, docx, txt; up to 50MB) upload directly and have no such limit.`;
}

/** Minimal slice of the axios client we need, so tests can pass a fake. */
export interface PostClient {
  post: (url: string, body?: unknown) => Promise<{ data: any }>;
}

export interface DirectUploadArgs {
  client: PostClient;
  fetchFn?: typeof fetch;
  brandId: string;
  bytes: Uint8Array;
  fileName: string;
  name?: string;
  description?: string;
  tags?: string[];
  type: DirectAssetType;
  mimeType: string;
}

/** upload-url -> PUT (plain fetch, exact signed headers, no Authorization) -> complete. Returns the complete response body. */
export async function uploadDirect(a: DirectUploadArgs): Promise<any> {
  const doFetch = a.fetchFn ?? fetch;
  const base = `/api/agent/v1/brands/${a.brandId}/assets`;
  const name = a.name ?? a.fileName;
  const presign = (
    await a.client.post(`${base}/upload-url`, {
      name,
      fileName: a.fileName,
      type: a.type,
      mimeType: a.mimeType,
      fileSize: a.bytes.byteLength,
    })
  ).data as { uploadUrl: string; uploadToken: string; headers: Record<string, string> };

  const put = await doFetch(presign.uploadUrl, {
    method: "PUT",
    headers: presign.headers,
    body: a.bytes as unknown as BodyInit,
  });
  if (!put.ok) {
    const text = await put.text().catch(() => "");
    throw new Error(`Direct upload to storage failed: HTTP ${put.status} ${text}`.trim());
  }

  const body: Record<string, unknown> = { uploadToken: presign.uploadToken, name };
  if (a.description) body.description = a.description;
  if (a.tags && a.tags.length) body.tags = a.tags;
  return (await a.client.post(`${base}/complete`, body)).data;
}
