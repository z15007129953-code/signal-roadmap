import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  distDir: process.env.E2E_RUN === "1" ? ".next-e2e" : ".next",
};

export default nextConfig;
