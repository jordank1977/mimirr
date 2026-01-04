/** @type {import('next').NextConfig} */
const nextConfig = {
  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'm.media-amazon.com',
        pathname: '/images/S/compressed.photo.goodreads.com/**',
      },
      {
        protocol: 'https',
        hostname: 'images.gr-assets.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 's.gr-assets.com',
        pathname: '/**',
      },
    ],
    formats: ['image/avif', 'image/webp'], // Modern formats for better performance
  },

  output: 'standalone',
  reactStrictMode: true, // Recommended for development

  // PERFORMANCE: Critical optimization to reduce module count (960-1500 → ~300-500)
  experimental: {
    optimizePackageImports: [
      'date-fns',
      '@radix-ui/react-alert-dialog',
    ],
    serverComponentsHmrCache: true, // Faster HMR in development (default: true)
  },

  // Production optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'], // Keep error and warn logs
    } : false,
  },
}

module.exports = nextConfig
