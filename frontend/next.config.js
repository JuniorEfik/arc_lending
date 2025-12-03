/** @type {import('next').NextConfig} */
const nextConfig = {
  // Only enable static export for production builds (for Netlify)
  // output: 'export' is disabled for dev mode
  ...(process.env.NODE_ENV === 'production' && process.env.STATIC_EXPORT === 'true' ? { output: 'export' } : {}),
  reactStrictMode: true,
  swcMinify: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  webpack: (config, { isServer }) => {
    // Optimize for faster builds
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    }
    
    // Reduce bundle size
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
      }
    }
    
    return config
  },
  // Optimize images
  images: {
    unoptimized: true,
  },
  // Experimental features for faster builds
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  // Disable trailing slash for better compatibility
  trailingSlash: false,
}

module.exports = nextConfig
