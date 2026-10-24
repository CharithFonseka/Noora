import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = process.env.VERCEL === "1"
  ? {}
  : { output: "standalone", outputFileTracingRoot: path.join(process.cwd(), "../..") };

export default nextConfig;

