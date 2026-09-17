import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  async redirects() {
    return [
      {
        source: "/downloads/QuazLink-Runner-Setup.exe",
        destination: "https://github.com/hadisalah07/QuazLink_Platform/releases/download/v26.9.5/QuazLink-Runner-Setup.exe",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
