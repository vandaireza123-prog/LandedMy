import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  transpilePackages: ["@landedmy/engine"],
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
