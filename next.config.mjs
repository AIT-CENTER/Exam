/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },

  // ESLint remove (not supported)
  eslint: undefined,

  // PDF loader (needs webpack)
  webpack: (config) => {
    config.module.rules.push({
      test: /\.pdf$/i,
      type: "asset/resource",
      generator: { filename: "static/chunks/[name].[hash][ext]" },
    });
    return config;
  },
};

export default nextConfig;
