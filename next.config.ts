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
  // Categories used to live at /areas, and the task list at /todos. Query
  // params pass through.
  redirects() {
    return [
      { source: "/todos", destination: "/do", permanent: false },
      { source: "/areas", destination: "/categories", permanent: true },
      { source: "/areas/:id", destination: "/categories/:id", permanent: true },
    ];
  },
};

export default nextConfig;
