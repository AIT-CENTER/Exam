/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,               // Dev-mode error tracking ni fooyyeessa
  trailingSlash: false,                // URL ogummaa & SEO
  output: "standalone",                // Vercel performance guddina

  eslint: {
    ignoreDuringBuilds: true,          // Build irratti eslint rakkoo hin uumu
  },

  typescript: {
    ignoreBuildErrors: true,           // Production irratti ts error dhaabsisa
  },

  images: {
    unoptimized: true,                 // Image Optimization hin barbaachisu yoo ta’e
  },

  experimental: {
    serverActions: false,              // Yoo server actions hin fayyadamne OFF gochuu
  },

  webpack: (config) => {
    // PDF files support
    config.module.rules.push({
      test: /\.pdf$/i,
      type: "asset/resource",
      generator: {
        filename: "static/chunks/[name].[hash][ext]",
      },
    });

    return config;
  },
};

export default nextConfig;
