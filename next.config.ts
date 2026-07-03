import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  images: {
    // Panorama-Thumbnails (Szenenleiste/Editor) nutzen quality={60}
    qualities: [60, 75],
  },
};

export default nextConfig;
