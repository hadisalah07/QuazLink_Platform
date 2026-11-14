import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  async rewrites() {
    return [
      {
        source: "/preview",
        destination: "/preview.html",
      },
    ];
  },
};

export default nextConfig;
