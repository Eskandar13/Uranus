import "server-only";
import path from "node:path";

/**
 * File locations for local mode. Everything lives under ".data/" in the project root
 * (git-ignored): the JSON database and uploaded images.
 */
export const DATA_DIR = path.join(/* turbopackIgnore: true */ process.cwd(), ".data");
export const DB_FILE = path.join(DATA_DIR, "db.json");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

/** Public URL prefix of local uploads (served by app/uploads/[...path]/route.ts). */
export const UPLOADS_URL_PREFIX = "/uploads/";

/** Upload content types we accept, with their file extension. */
export const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpeg",
  "image/jpg": "jpeg",
  "image/pjpeg": "jpeg",
  "image/png": "png",
  "image/avif": "avif",
  "image/svg+xml": "svg",
};

/** Content-Type for each extension we serve. */
export const EXTENSION_CONTENT_TYPES: Record<string, string> = {
  webp: "image/webp",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  avif: "image/avif",
  svg: "image/svg+xml",
};

/** A safe path segment: no traversal, separators, drive letters or control characters. */
export function isSafeSegment(segment: string): boolean {
  return (
    typeof segment === "string" &&
    segment.length > 0 &&
    segment.length <= 200 &&
    segment !== "." &&
    segment !== ".." &&
    !segment.includes("..") &&
    !/[\\/:*?"<>|\u0000-\u001f]/.test(segment)
  );
}

/**
 * Resolves URL path segments (e.g. ["<restaurantId>", "item", "<file>.webp"]) to an absolute file
 * path inside UPLOADS_DIR, or null when any segment is unsafe or the result escapes the folder.
 */
export function resolveUploadPath(segments: string[]): string | null {
  if (!Array.isArray(segments) || segments.length === 0 || segments.length > 6) return null;
  if (!segments.every(isSafeSegment)) return null;
  const resolved = path.resolve(UPLOADS_DIR, ...segments);
  const root = path.resolve(UPLOADS_DIR) + path.sep;
  return resolved.startsWith(root) ? resolved : null;
}

/** Same as resolveUploadPath but from a public URL like "/uploads/<rid>/item/<file>.webp". */
export function resolveUploadUrl(url: string): string | null {
  if (typeof url !== "string" || !url.startsWith(UPLOADS_URL_PREFIX)) return null;
  const clean = url.slice(UPLOADS_URL_PREFIX.length).split(/[?#]/)[0];
  let segments: string[];
  try {
    segments = clean.split("/").map((s) => decodeURIComponent(s));
  } catch {
    return null;
  }
  return resolveUploadPath(segments);
}
