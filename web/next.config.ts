import type { NextConfig } from 'next';

// Security headers on every response (#186, from the OWASP ZAP scan). The Content Security Policy needs a fresh
// nonce per page, so it is set in src/proxy.ts instead.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Shared plan links are only ever opened over HTTPS from now on.
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  // The site uses no camera, microphone, location or payment features; turn them off for anything on it.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
];

const nextConfig: NextConfig = {
  // A self-contained server in .next/standalone, so the Docker image only needs Node to run it.
  output: 'standalone',
  reactCompiler: true,
  // Don't announce "X-Powered-By: Next.js" to scanners.
  poweredByHeader: false,
  headers: async () => [{ source: '/:path*', headers: securityHeaders }],
};

export default nextConfig;
