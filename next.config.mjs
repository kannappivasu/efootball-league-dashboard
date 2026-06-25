/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: import.meta.dirname,
  serverExternalPackages: ["@prisma/adapter-libsql", "@libsql/client"],
  outputFileTracingIncludes: {
    "/*": ["./prisma/data/**/*"],
  },
  experimental: {
    serverActions: { bodySizeLimit: "2mb" }
  }
};

export default nextConfig;
