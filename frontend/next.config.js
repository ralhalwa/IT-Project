/** @type {import('next').NextConfig} */

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window === "undefined" ? "http://backend:8080" : "http://localhost:8080");

const nextConfig = {
  reactStrictMode: true,

  async rewrites() {
    return [
      { source: "/api/:path*",     destination: `${API_URL}/api/:path*` },
      { source: "/uploads/:path*", destination: `${API_URL}/uploads/:path*` },
    ];
  },

  eslint: { ignoreDuringBuilds: true },

  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
