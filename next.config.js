// =====================================================================
// next.config.js  —  Phase 7 (performance) + Phase 8 (security headers)
// =====================================================================

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ── Performance (Phase 7) ─────────────────────────────────────────
  compress:        true,
  poweredByHeader: false,
  reactStrictMode: true,

  // ── Tell webpack NOT to bundle native Node addons ─────────────────
  // onnxruntime-node ships pre-compiled .node binaries for each
  // platform/arch. Webpack cannot parse them — mark the package as
  // external so Node.js loads it at runtime instead.
  webpack(config, { isServer }) {
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean)),
        "onnxruntime-node",
      ];
    }
    // Suppress "Critical dependency: the request of a require is an
    // expression" warnings from onnxruntime-node's dynamic require paths.
    config.module = config.module ?? {};
    config.module.exprContextCritical = false;
    return config;
  },

  // ── Security Headers (Phase 8 — S14) ─────────────────────────────
  // Applied to every route via the headers() function.
  // These headers protect against common web vulnerabilities:
  //   X-Frame-Options          — prevents clickjacking (UI redress attacks)
  //   X-Content-Type-Options   — prevents MIME-type sniffing
  //   Referrer-Policy          — limits referrer information leakage
  //   Permissions-Policy       — disables unused browser features
  //   X-XSS-Protection         — legacy XSS filter (belt-and-suspenders)
  //   Strict-Transport-Security— enforces HTTPS (once deployed to production)
  // NOTE: A full Content-Security-Policy is not added here because the app
  // uses Supabase (external JS/CSS), recharts, Google reCAPTCHA, and Google
  // Fonts — a permissive CSP nonce-based policy should be configured per
  // deployment environment. A restrictive blanket CSP would break the app.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key:   "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key:   "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key:   "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key:   "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          {
            key:   "X-XSS-Protection",
            value: "1; mode=block",
          },
          // Only enforce HSTS in production — prevents breaking local dev over HTTP
          ...(process.env.NODE_ENV === "production"
            ? [
                {
                  key:   "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains; preload",
                },
              ]
            : []),
        ],
      },
    ];
  },

  // ── Image optimisation (Phase 7) ─────────────────────────────────
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
