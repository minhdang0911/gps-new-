import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    // ✅ Tắt CSS optimization (critters có thể gây lỗi với Antd)
    experimental: {
        optimizeCss: false,
        // ✅ Tree-shake các thư viện lớn — giảm bundle đáng kể
        optimizePackageImports: [
            'antd',
            '@ant-design/icons',
            'lucide-react',
            'recharts',
            '@ant-design/charts',
        ],
    },

    // ✅ Automatically remove console.log in production (keep error & warn for debugging)
    compiler: {
        removeConsole: process.env.NODE_ENV === 'production'
            ? { exclude: ['error', 'warn'] }
            : false,
    },

    // ✅ Next.js 16: Turbopack enabled by default
    turbopack: {},

    // ✅ Gzip/Brotli compression
    compress: true,

    // ✅ Bỏ X-Powered-By header
    poweredByHeader: false,

    // ✅ Strict mode giúp phát hiện re-render sớm
    reactStrictMode: true,

    // ✅ Tối ưu image nếu có domain ngoài
    images: {
        formats: ['image/avif', 'image/webp'],
        minimumCacheTTL: 60,
    },
};

export default nextConfig;
