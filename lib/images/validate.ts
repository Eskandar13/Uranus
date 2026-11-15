/**
 * Image validation shared by the browser (before compression) and server actions (before upload).
 * Pure module: no browser or server-only APIs, safe to import anywhere.
 */

/** Types the dashboard accepts from the owner's device. */
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/svg+xml"] as const;
export type AcceptedImageType = (typeof ACCEPTED_IMAGE_TYPES)[number];

/** `accept` attribute for <input type="file">. HEIC is not listed: browsers cannot decode it. */
export const IMAGE_ACCEPT_ATTR = ACCEPTED_IMAGE_TYPES.join(",");

/** Largest original file we try to compress in the browser. */
export const MAX_ORIGINAL_BYTES = 15 * 1024 * 1024;

/** Largest (already compressed) file a server action accepts. */
export const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;

export type ImageValidationError = "imageType" | "imageTooLarge";

export function isAcceptedImageType(type: string): type is AcceptedImageType {
  return (ACCEPTED_IMAGE_TYPES as readonly string[]).includes((type || "").toLowerCase());
}

/** Checks an original file picked by the owner (before compression). */
export function validateImageFile(
  file: { type: string; size: number },
  opts: { allowSvg?: boolean; maxBytes?: number } = {},
): ImageValidationError | null {
  const type = (file.type || "").toLowerCase();
  if (!isAcceptedImageType(type)) return "imageType";
  if (type === "image/svg+xml" && !opts.allowSvg) return "imageType";
  if (file.size <= 0 || file.size > (opts.maxBytes ?? MAX_ORIGINAL_BYTES)) return "imageTooLarge";
  return null;
}

/** Human readable size, e.g. "1.4 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
