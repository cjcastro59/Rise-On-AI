// =====================================================================
// next.config.js  —  Phase 7 System Optimization
//
// Changes vs baseline:
//   + compress: true         — Brotli/gzip compression for all responses
//   + poweredByHeader: false — removes "X-Powered-By: Next.js" header (minor security)
//   + reactStrictMode: true  — catches double-invocation bugs early in dev
//   + images.formats          — explicit WebP/AVIF hint for Next.js image optimiser
// =====================================================================

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ── Performance ──────────────────────────────────────────────────────────
  // Baseline: no explicit compression config.
  // After: Node.js server compresses all text/JSON/HTML responses.
  // Impact: ~30–60% reduction in transfer size for API JSON payloads.
  compress: true,

  // ── Security / hygiene ───────────────────────────────────────────────────
  poweredByHeader: false,

  // ── Development quality ──────────────────────────────────────────────────
  reactStrictMode: true,

  // ── Image optimisation ───────────────────────────────────────────────────
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "qjseheifcmazzljxainy.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

module.exports = nextConfig;
