import type { NextConfig } from "next";

const supabaseHost = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : null;
  } catch {
    return null;
  }
})();

/**
 * Public site URL (QR codes, canonical links, sitemap). NEXT_PUBLIC_APP_URL wins; on a Netlify
 * build without it, Netlify's own URL variable (the site's main address) is used, so a forgotten
 * variable never bakes "http://localhost:3000" into the deployed site. Undefined elsewhere, which
 * leaves lib/env.ts's local fallback in place.
 */
const appUrl =
  process.env.NEXT_PUBLIC_APP_URL || (process.env.NETLIFY === "true" ? process.env.URL : undefined) || undefined;

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Inlined at build time in server and client code, like any NEXT_PUBLIC_ value.
  env: { NEXT_PUBLIC_APP_URL: appUrl },
  // Pages that have no <link rel="icon"> (e.g. error pages) make browsers ask for /favicon.ico.
  async redirects() {
    return [{ source: "/favicon.ico", destination: "/icon.svg", permanent: true }];
  },
  partialPrefetching: true,
  // Lets a second dev server run side by side (e.g. NEXT_DIST_DIR=.next-alt next dev -p 3001).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 414, 640, 768, 1024, 1280, 1536, 1920],
    imageSizes: [48, 64, 96, 128, 192, 256, 384],
    remotePatterns: [
      // Demo photos (Unsplash license allows free commercial use).
      { protocol: "https", hostname: "images.unsplash.com" },
      // Supabase Storage (restaurant uploads).
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
      ...(supabaseHost ? [{ protocol: "https" as const, hostname: supabaseHost }] : []),
    ],
    localPatterns: [
      // Local-mode uploads served by app/uploads/[...path]/route.ts, plus static assets.
      { pathname: "/uploads/**" },
      { pathname: "/demo/**" },
      { pathname: "/brand/**" },
    ],
  },
  experimental: {
    serverActions: {
      // Compressed images are ~100–400 KB; leave headroom for originals that skip compression.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
