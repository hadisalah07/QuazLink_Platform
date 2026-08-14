import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: process.env.INTERNAL_API_URL || (process.env.NODE_ENV === "production" ? "http://api:3001/api/:path*" : "http://localhost:3001/api/:path*"),
      },
    ];
  },
};

export default nextConfig;
