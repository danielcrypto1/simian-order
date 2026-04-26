/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compiler: {
    // Strip all console.* calls in production builds (keeps dev logs intact).
    removeConsole: process.env.NODE_ENV === "production" ? true : false,
  },
};

module.exports = nextConfig;
