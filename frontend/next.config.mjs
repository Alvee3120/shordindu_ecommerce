/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactCompiler: true,
  // Lets the Next dev server accept requests coming in through a VS Code dev
  // tunnel's forwarded https origin (a different random subdomain per session).
  allowedDevOrigins: ["*.devtunnels.ms"],
  images: {
    dangerouslyAllowLocalIP: true,
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "8000", pathname: "/media/**" },
      { protocol: "http", hostname: "127.0.0.1", port: "8000", pathname: "/media/**" },
      { protocol: "https", hostname: "*.devtunnels.ms", pathname: "/media/**" },
    ],
  },
};

export default nextConfig;
