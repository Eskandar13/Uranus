/**
 * Browser-only image helpers for the dashboard uploaders. Import them from Client Components only
 * (they use canvas, FileReader and createImageBitmap). Nothing here runs during server render:
 * every function is called from event handlers.
 *
 * Flow: validateImageFile -> compressImage (resize + WebP) -> makeBlurDataUrl (tiny placeholder)
 * -> FormData -> uploadImageAction on the server.
 */
import { MAX_UPLOAD_BYTES, validateImageFile, type ImageValidationError } from "./validate";

export type ImageKind = "item" | "category" | "cover" | "logo";

/** Longest edge per kind (px). */
export const MAX_EDGE: Record<ImageKind, number> = {
  item: 1600,
  category: 1600,
  cover: 2000,
  logo: 512,
};

export interface CompressOptions {
  /** Longest edge in px (default 1600). */
  maxSize?: number;
  /** 0..1 (default 0.82). */
  quality?: number;
  /** Output MIME type (default "image/webp"). */
  type?: string;
}

/**
 * Resizes and re-encodes an image in the browser (default: max 1600px, WebP, quality 0.82).
 * SVG files are returned unchanged (vector, already tiny). If compression fails or makes the file
 * bigger, the original is returned when it is small enough to upload.
 */
export async function compressImage(file: File, opts: CompressOptions = {}): Promise<File> {
  if (file.type === "image/svg+xml") return file;
  const { maxSize = 1600, quality = 0.82, type = "image/webp" } = opts;
  try {
    const { default: imageCompression } = await import("browser-image-compression");
    const out = await imageCompression(file, {
      maxWidthOrHeight: maxSize,
      initialQuality: quality,
      fileType: type,
      maxSizeMB: 1.5,
      // The worker build downloads the library from a CDN; compress on the main thread instead.
      useWebWorker: false,
    });
    const ext = type.split("/")[1] ?? "webp";
    const base = file.name.replace(/\.[^.]+$/, "") || "image";
    const compressed = new File([out], `${base}.${ext}`, { type, lastModified: Date.now() });
    if (compressed.size > file.size && file.size <= MAX_UPLOAD_BYTES && file.type !== "image/avif") return file;
    return compressed;
  } catch {
    if (file.size <= MAX_UPLOAD_BYTES) return file;
    throw new Error("compress_failed");
  }
}

/** Loads a file into something drawable on a canvas. */
async function loadDrawable(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; done: () => void }> {
  if (typeof createImageBitmap === "function" && file.type !== "image/svg+xml") {
    try {
      const bmp = await createImageBitmap(file);
      return { source: bmp, width: bmp.width, height: bmp.height, done: () => bmp.close() };
    } catch {
      // Fall back to <img> below.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return {
      source: img,
      width: img.naturalWidth || 64,
      height: img.naturalHeight || 64,
      done: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

/**
 * Tiny (16px on the longest edge) JPEG data URL used as a blurred placeholder while the real
 * photo loads (next/image placeholder="blur"). Returns null for SVG or when decoding fails.
 */
export async function makeBlurDataUrl(file: Blob, size = 16): Promise<string | null> {
  if (file.type === "image/svg+xml") return null;
  try {
    const { source, width, height, done } = await loadDrawable(file);
    const scale = size / Math.max(width, height);
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      done();
      return null;
    }
    ctx.drawImage(source, 0, 0, w, h);
    done();
    const url = canvas.toDataURL("image/jpeg", 0.6);
    return url.startsWith("data:image/jpeg") ? url : null;
  } catch {
    return null;
  }
}

export type PreparedImage =
  | { ok: true; file: File; blur: string | null; previewUrl: string }
  | { ok: false; error: ImageValidationError | "compressFailed" };

/**
 * Validates, compresses and creates the blur placeholder for one picked file.
 * `previewUrl` is an object URL: revoke it with URL.revokeObjectURL when no longer shown.
 */
export async function prepareImage(file: File, kind: ImageKind): Promise<PreparedImage> {
  const invalid = validateImageFile(file, { allowSvg: kind === "logo" });
  if (invalid) return { ok: false, error: invalid };
  let out: File;
  try {
    out = await compressImage(file, { maxSize: MAX_EDGE[kind], quality: 0.82, type: "image/webp" });
  } catch {
    return { ok: false, error: "compressFailed" };
  }
  if (out.size > MAX_UPLOAD_BYTES) return { ok: false, error: "imageTooLarge" };
  const blur = kind === "logo" ? null : await makeBlurDataUrl(out);
  return { ok: true, file: out, blur, previewUrl: URL.createObjectURL(out) };
}
