import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: "standalone", // <--- Add this line
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;