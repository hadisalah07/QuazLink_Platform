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
      {
        source: "/downloads/QuazLink-POS-Setup.exe",
        destination: "https://github.com/hadisalah07/QuazLink_Platform/releases/download/pos-v1.0.0/QuazLink-POS-Setup.exe",
        permanent: false,
      },
      {
        source: "/downloads/QuazLink-POS-Portable.zip",
        destination: "https://github.com/hadisalah07/QuazLink_Platform/releases/download/pos-v1.0.0/QuazLink-POS-Portable.zip",
        permanent: false,
      },
      {
        source: "/downloads/QuazLink-POS-Legacy-Win7-Setup.exe",
        destination: "https://github.com/hadisalah07/QuazLink_Platform/releases/download/pos-v1.0.0/QuazLink-POS-Legacy-Win7-Setup.exe",
        permanent: false,
      },
      {
        source: "/downloads/QuazLink-POS-Legacy-Win7-Portable.exe",
        destination: "https://github.com/hadisalah07/QuazLink_Platform/releases/download/pos-v1.0.0/QuazLink-POS-Legacy-Win7-Portable.exe",
        permanent: false,
      },
      {
        source: "/downloads/QuazLink-POS-Legacy-Win7-Portable.zip",
        destination: "https://github.com/hadisalah07/QuazLink_Platform/releases/download/pos-v1.0.0/QuazLink-POS-Legacy-Win7-Portable.zip",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
