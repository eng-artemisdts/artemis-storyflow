import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16.2 loga cada Server Action com argumentos no terminal.
  // O auto-save do whiteboard (JSON enorme) polui o console — desligado.
  logging: {
    serverFunctions: false,
  },
  // Standalone facilita empacotar no Electron (node server.js).
  output: process.env.STORYFLOW_DESKTOP === "1" ? "standalone" : undefined,
  serverExternalPackages: [
    "capcut-cli",
    "better-sqlite3",
  ],
  experimental: {
    // No Next 16.2, bodySizeLimit das Server Actions fica em experimental.
    serverActions: {
      bodySizeLimit: "50mb",
    },
    proxyClientMaxBodySize: "50mb",
  },
  async rewrites() {
    // Serve uploads via route (suporta STORYFLOW_DATA_DIR no desktop).
    return [
      {
        source: "/uploads/:path*",
        destination: "/api/file-uploads/:path*",
      },
    ];
  },
};

export default nextConfig;
