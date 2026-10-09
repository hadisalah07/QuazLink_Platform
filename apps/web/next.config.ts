import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  // Serve downloads directly from public/downloads when present
};

export default nextConfig;
