import { promises as fs } from "node:fs";
import path from "node:path";
import { EXTENSION_CONTENT_TYPES, resolveUploadPath } from "@/lib/data/local/paths";

/**
 * Serves local-mode uploads from .data/uploads/<restaurantId>/<folder>/<file>.
 * File names are random UUIDs and never overwritten, so responses are cached forever.
 */
export async function GET(_request: Request, ctx: RouteContext<"/uploads/[...path]">) {
  const { path: segments } = await ctx.params;
  const notFound = () =>
    new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });

  const filePath = resolveUploadPath(Array.isArray(segments) ? segments : [segments]);
  if (!filePath) return notFound();

  const ext = path.extname(filePath).slice(1).toLowerCase();
  const contentType = EXTENSION_CONTENT_TYPES[ext];
  if (!contentType) return notFound();

  let data: Buffer;
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) return notFound();
    data = await fs.readFile(filePath);
  } catch {
    return notFound();
  }

  return new Response(new Uint8Array(data), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(data.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      // Uploaded SVGs must never run scripts on our origin.
      "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
    },
  });
}
