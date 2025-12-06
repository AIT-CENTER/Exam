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

// Export clean config
export default nextConfig;
