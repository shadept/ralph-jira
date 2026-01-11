import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: 'standalone',
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-better-sqlite3'],
  outputFileTracingIncludes: {
    '/**/*': ['./generated/prisma/**/*', './prisma/ralph.db'],
  },
};

export default nextConfig;
