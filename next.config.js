/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  generateEtags: true,
  reactStrictMode: true,
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
};

module.exports = nextConfig;
