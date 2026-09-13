import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: process.env.APP_UI_TEST === '1' ? '.next-ui' : '.next',
  devIndicators: false,
};

export default nextConfig;
