import type { NextConfig } from "next";
import nextBundleAnalyzer from '@next/bundle-analyzer';

const isElectron = process.env.ELECTRON === "true";

// Initialize the bundle analyzer HOC (Higher-Order Component)
const withBundleAnalyzer = nextBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  assetPrefix: isElectron ? '.' : undefined,
  basePath: isElectron ? '' : undefined,
};

// Wrap your existing config with the analyzer
export default withBundleAnalyzer(nextConfig);