import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // A self-contained server in .next/standalone, so the Docker image only needs Node to run it.
  output: 'standalone',
  reactCompiler: true,
};

export default nextConfig;
