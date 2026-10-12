/** @type {import('next').NextConfig} */
const nextConfig = {
  // The end-to-end suite runs its own dev server with a separate build directory.
  distDir: process.env.NEXT_DIST_DIR || '.next',
};

export default nextConfig;
