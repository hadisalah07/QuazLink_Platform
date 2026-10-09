import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  async redirects() {
    return [
      // Desktop Runner redirects (v26.10.13)
      {
        source: "/downloads/QuazLink-Runner-Setup-v26.10.13.exe",
        destination: "https://github.com/hadisalah07/QuazLink_Platform/releases/download/v26.10.13/QuazLink-Runner-Setup-v26.10.13.exe",
        permanent: false,
      },
      {
        source: "/downloads/QuazLink-Runner-Setup.exe",
        destination: "https://github.com/hadisalah07/QuazLink_Platform/releases/download/v26.10.13/QuazLink-Runner-Setup-v26.10.13.exe",
        permanent: false,
      },

      // POS Modern redirects (v1.1.0)
      {
        source: "/downloads/QuazLink-POS-Setup-v1.1.0.exe",
        destination: "https://github.com/hadisalah07/QuazLink_Platform/releases/download/pos-v1.1.0/QuazLink-POS-Setup-v1.1.0.exe",
        permanent: false,
      },
      {
        source: "/downloads/QuazLink-POS-Setup.exe",
        destination: "https://github.com/hadisalah07/QuazLink_Platform/releases/download/pos-v1.1.0/QuazLink-POS-Setup-v1.1.0.exe",
        permanent: false,
      },
      {
        source: "/downloads/QuazLink-POS-Portable-v1.1.0.zip",
        destination: "https://github.com/hadisalah07/QuazLink_Platform/releases/download/pos-v1.1.0/QuazLink-POS-Portable-v1.1.0.zip",
        permanent: false,
      },
      {
        source: "/downloads/QuazLink-POS-Portable.zip",
        destination: "https://github.com/hadisalah07/QuazLink_Platform/releases/download/pos-v1.1.0/QuazLink-POS-Portable-v1.1.0.zip",
        permanent: false,
      },

      // POS Legacy Windows 7 redirects (v1.1.0)
      {
        source: "/downloads/QuazLink-POS-Legacy-Win7-Setup-v1.1.0.exe",
        destination: "https://github.com/hadisalah07/QuazLink_Platform/releases/download/pos-v1.1.0/QuazLink-POS-Legacy-Win7-Setup-v1.1.0.exe",
        permanent: false,
      },
      {
        source: "/downloads/QuazLink-POS-Legacy-Win7-Setup.exe",
        destination: "https://github.com/hadisalah07/QuazLink_Platform/releases/download/pos-v1.1.0/QuazLink-POS-Legacy-Win7-Setup-v1.1.0.exe",
        permanent: false,
      },
      {
        source: "/downloads/QuazLink-POS-Legacy-Win7-Portable-v1.1.0.zip",
        destination: "https://github.com/hadisalah07/QuazLink_Platform/releases/download/pos-v1.1.0/QuazLink-POS-Legacy-Win7-Portable-v1.1.0.zip",
        permanent: false,
      },
      {
        source: "/downloads/QuazLink-POS-Legacy-Win7-Portable.zip",
        destination: "https://github.com/hadisalah07/QuazLink_Platform/releases/download/pos-v1.1.0/QuazLink-POS-Legacy-Win7-Portable.zip",
        permanent: false,
      },
      {
        source: "/downloads/QuazLink-POS-Legacy-Win7-Portable.exe",
        destination: "https://github.com/hadisalah07/QuazLink_Platform/releases/download/pos-v1.1.0/QuazLink-POS-Legacy-Win7-Portable.exe",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
