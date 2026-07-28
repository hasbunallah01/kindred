import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // @kindred/db and @kindred/shared ship raw TypeScript (no build step) —
  // Next.js needs to transpile them directly rather than expecting
  // compiled JS in node_modules.
  transpilePackages: ['@kindred/db', '@kindred/shared'],
};

export default nextConfig;
