import withPWAInit from "next-pwa";

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },

  // PDF loader
  webpack: (config) => {
    config.module.rules.push({
      test: /\.pdf$/i,
      type: "asset/resource",
      generator: { filename: "static/chunks/[name].[hash][ext]" },
    });
    return config;
  },
};

// Initialize PWA with configuration
const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  // Add these to fix the GenerateSW warnings
  buildExcludes: [/chunks\/images\/.*$/], // Exclude dynamic images
  exclude: [
    /\.map$/, // Exclude source maps
    /^manifest.*\.js$/, // Exclude manifest files
  ],
});

// Export the wrapped config
export default withPWA(nextConfig);