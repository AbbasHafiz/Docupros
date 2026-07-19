import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export so the app can be hosted on any free CDN (ZeroDeploy, etc.).
  output: "export",
  images: { unoptimized: true },
  transpilePackages: ["@imgly/background-removal", "onnxruntime-web"],
  experimental: {
    optimizePackageImports: ["jspdf"],
  },
};

export default nextConfig;
