import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow large in-memory document images during local scanning workflows.
  experimental: {
    optimizePackageImports: ["jspdf"],
  },
};

export default nextConfig;
