/** @type {import('next').NextConfig} */

// STATIC_EXPORT=1 builds a static site for GitHub Pages, served under PAGES_BASE_PATH (e.g. /HD-Beauty).
const isStaticExport = process.env.STATIC_EXPORT === '1';
const basePath = process.env.PAGES_BASE_PATH ?? '';

const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['firebasestorage.googleapis.com'],
  },
  ...(isStaticExport && {
    output: 'export',
    basePath,
    trailingSlash: true,
    env: { NEXT_PUBLIC_BASE_PATH: basePath },
    images: { loader: 'custom', loaderFile: './src/lib/image-loader.ts' },
  }),
};

let exportedConfig = nextConfig;

try {
  const withSerwist = require('@serwist/next').default({
    swSrc: 'src/app/sw.ts',
    swDest: 'public/sw.js',
    reloadOnOnline: true,
    disable: process.env.NODE_ENV === 'development' || isStaticExport,
  });
  exportedConfig = withSerwist(nextConfig);
} catch {
  // @serwist/next not yet installed — run npm install first
}

module.exports = exportedConfig;
