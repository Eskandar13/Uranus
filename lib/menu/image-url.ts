/**
 * True when next/image may optimise this URL (matches next.config images.remotePatterns /
 * localPatterns). Anything else must be rendered `unoptimized`, otherwise next/image throws
 * an unconfigured-host error and takes the whole public menu down.
 */
export function isOptimizableImage(src: string): boolean {
  if (src.startsWith("/") && !src.startsWith("//")) {
    return /^\/(uploads|demo|brand)\//.test(src.split("?")[0]);
  }
  try {
    const u = new URL(src);
    if (u.protocol !== "https:") return false;
    if (u.hostname === "images.unsplash.com") return true;
    if (u.hostname.endsWith(".supabase.co") && u.pathname.startsWith("/storage/v1/object/public/")) return true;
    const env = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return Boolean(env && u.hostname === new URL(env).hostname);
  } catch {
    return false;
  }
}
