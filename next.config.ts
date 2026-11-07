import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Categories used to live at /areas. Query params pass through.
  redirects() {
    return [
      { source: "/areas", destination: "/categories", permanent: true },
      { source: "/areas/:id", destination: "/categories/:id", permanent: true },
    ];
  },
};

export default nextConfig;
