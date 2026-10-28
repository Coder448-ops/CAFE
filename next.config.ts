import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native module: keep better-sqlite3 out of the bundler, load it at runtime.
  serverExternalPackages: ["better-sqlite3"],
  // The sandbox preview proxies the dev server under *.e2b.app; allow those
  // origins so HMR/client assets are not blocked in development.
  allowedDevOrigins: ["*.e2b.app", "localhost", "127.0.0.1"],
  poweredByHeader: false,
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },
};

export default nextConfig;
