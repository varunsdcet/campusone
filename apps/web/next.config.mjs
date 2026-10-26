/** @type {import('next').NextConfig} */
const apiProxyTarget = (process.env.API_PROXY_TARGET || "http://127.0.0.1:4000").replace(/\/$/, "");

const nextConfig = {
  output: "standalone",
  transpilePackages: ["@myheritage/ui", "@myheritage/tokens", "@myheritage/contracts"],
  experimental: {
    externalDir: true,
    // Requests proxied through /__api are buffered up to this size; base64 uploads of 10 MiB files need ~14 MB.
    middlewareClientMaxBodySize: "20mb",
    // AI drafts (lesson + quiz + narrated slideshow) can take well over the 30 s default to generate.
    proxyTimeout: 180_000,
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },
  async rewrites() {
    return [
      {
        source: "/__api/:path*",
        destination: `${apiProxyTarget}/:path*`,
      },
    ];
  },
};

export default nextConfig;
