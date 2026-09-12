import type { NextConfig } from "next";
import path from "node:path";

const CANONICAL = "https://petrock.fun";
const ALIAS_HOSTS = [
  "www.petrock.fun",
  "jamiespetrock.com",
  "www.jamiespetrock.com",
  "jamiespetrock.fun",
  "www.jamiespetrock.fun",
  "petrock.io",
  "www.petrock.io",
];

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  async redirects() {
    return ALIAS_HOSTS.flatMap((host) => [
      {
        source: "/",
        has: [{ type: "host" as const, value: host }],
        destination: CANONICAL,
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host" as const, value: host }],
        destination: `${CANONICAL}/:path*`,
        permanent: true,
      },
    ]);
  },
};

export default nextConfig;
