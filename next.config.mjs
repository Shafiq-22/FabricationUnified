/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Lint is run explicitly in CI; do not fail production builds on lint.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
