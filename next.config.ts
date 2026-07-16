import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16.2 loga cada Server Action com argumentos no terminal.
  // O auto-save do whiteboard (JSON enorme) polui o console — desligado.
  logging: {
    serverFunctions: false,
  },
  transpilePackages: [
    "remotion",
    "@remotion/player",
    "@remotion/media-utils",
  ],
  serverExternalPackages: [
    "@remotion/renderer",
    "@remotion/bundler",
    "@remotion/compositor-darwin-arm64",
    "@remotion/compositor-darwin-x64",
    "@remotion/compositor-linux-x64-gnu",
    "@remotion/compositor-linux-x64-musl",
    "@remotion/compositor-win32-x64-msvc",
  ],
  experimental: {
    // No Next 16.2, bodySizeLimit das Server Actions fica em experimental.
    serverActions: {
      bodySizeLimit: "50mb",
    },
    proxyClientMaxBodySize: "50mb",
  },
};

export default nextConfig;
