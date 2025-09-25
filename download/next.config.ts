import type { NextConfig } from "next";
import nextBundleAnalyzer from '@next/bundle-analyzer';

const isElectron = process.env.ELECTRON === "true";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  assetPrefix: isElectron ? '.' : undefined,
  basePath: isElectron ? '' : undefined,
};
