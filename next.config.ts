import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['exceljs', 'pdfkit', 'unpdf', 'mammoth', '@prisma/client'],
  experimental: {
    // Uploads are streamed to the storage adapter; keep the server action body
    // limit aligned with MAX_UPLOAD_MB so large evidence files are not rejected
    // before our own validation runs.
    serverActions: { bodySizeLimit: '30mb' },
  },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'images.unsplash.com' }],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
