/** @type {import('next').NextConfig} */
const nextConfig = {
  // Image optimization - Allow images from any source to support Bookshelf's remote and proxy URLs
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
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

  // Ensure pino is treated as a server-side module to avoid bundler issues
  serverExternalPackages: ['pino', 'pino-pretty', 'pino-roll'],
}

module.exports = nextConfig
