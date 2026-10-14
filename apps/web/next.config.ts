import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

// Monorepo root, so file tracing (OpenNext / Cloudflare build) picks up workspace packages.
const root = fileURLToPath(new URL('../..', import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Self-contained server (.next/standalone) — used by the one-click desktop bundle and by OpenNext.
  output: 'standalone',
  outputFileTracingRoot: root,
  turbopack: { root },
};

export default nextConfig;
