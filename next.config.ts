import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow development origin requests for local network and 127.0.0.1
  allowedDevOrigins: ['localhost', '127.0.0.1'],
};

export default nextConfig;
