/** @type {import('next').NextConfig} */
const nextConfig = {
  // --- Kutaa duraan ture ---
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },

  // --- KUTAA HAARAA KAN DABALAMU (FOR PDF FILES) ---
  webpack: (config) => {
    // Seera haaraa faayilota .pdf akka 'asset/resource' tti qabamu dabali
    config.module.rules.push({
      test: /\.pdf$/i,
      type: 'asset/resource',
      generator: {
        // Iddoo faayilichi itti kuufamu fi maqaa isaa
        filename: 'static/chunks/[name].[hash][ext]',
      },
    });

    // Konfigireeshinii fooyya'e deebisi
    return config;
  },
};

export default nextConfig;