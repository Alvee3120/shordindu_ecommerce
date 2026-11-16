import path from "node:path";

const here = import.meta.dirname;

// Host that serves uploaded media once the backend stores files in Cloudflare
// R2 (or any S3 bucket) instead of its local /media/ directory. No scheme —
// next/image wants just the hostname. Unset = local media only.
const mediaHostname = process.env.NEXT_PUBLIC_MEDIA_HOSTNAME;

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactCompiler: true,
  // Emits .next/standalone (server.js + traced node_modules) so the production
  // server only needs a Node runtime, not a build toolchain or npm install.
  output: "standalone",
  // The repo root has its own package.json/package-lock.json (a stray `sonner`
  // dependency), which makes Next infer that as the workspace root and emit
  // .next/standalone/frontend/server.js. Pinning both roots here keeps the
  // standalone layout — and module resolution — deterministic.
  outputFileTracingRoot: path.join(here, "."),
  turbopack: { root: here },
  // Lets the Next dev server accept requests coming in through a VS Code dev
  // tunnel's forwarded https origin (a different random subdomain per session).
  allowedDevOrigins: ["*.devtunnels.ms"],
  images: {
    dangerouslyAllowLocalIP: true,
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "8000", pathname: "/media/**" },
      { protocol: "http", hostname: "127.0.0.1", port: "8000", pathname: "/media/**" },
      { protocol: "https", hostname: "*.devtunnels.ms", pathname: "/media/**" },
      // Production: the API returns absolute media URLs on the deploy host.
      { protocol: "http", hostname: "13.236.66.156", pathname: "/media/**" },
      // Cloudflare R2 bucket. Files live under the "media/" key prefix, keyed
      // by the storage location in settings.py.
      { protocol: "https", hostname: "**.r2.dev", pathname: "/media/**" },
      ...(mediaHostname
        ? [{ protocol: "https", hostname: mediaHostname, pathname: "/media/**" }]
        : []),
    ],
  },
};

export default nextConfig;
