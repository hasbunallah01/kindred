import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // @kindred/db ships raw TypeScript (no build step) — Next.js needs to
  // transpile it directly rather than expecting compiled JS in node_modules.
  transpilePackages: ['@kindred/db'],
};

export default nextConfig;
