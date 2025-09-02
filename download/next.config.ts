import type { NextConfig } from "next";

const isElectron = process.env.ELECTRON === "true";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  assetPrefix: isElectron ? "./" : undefined, // important for electron
  basePath: isElectron ? "" : undefined,
};

export default nextConfig;
