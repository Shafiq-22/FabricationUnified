/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Lint, types and the smoke tests run as their own CI job
    // (.github/workflows/ci.yml); a deploy build does not repeat them.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
