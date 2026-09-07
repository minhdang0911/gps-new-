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

    // ✅ Webpack optimization cho production
    webpack(config, { dev, isServer }) {
        if (!dev && !isServer) {
            // Tách antd thành chunk riêng để cache browser tốt hơn
            config.optimization = {
                ...config.optimization,
                splitChunks: {
                    ...(config.optimization?.splitChunks || {}),
                    cacheGroups: {
                        ...(config.optimization?.splitChunks?.cacheGroups || {}),
                        antd: {
                            name: 'antd',
                            test: /[\\/]node_modules[\\/](antd|@ant-design)[\\/]/,
                            chunks: 'all',
                            priority: 10,
                        },
                        recharts: {
                            name: 'recharts',
                            test: /[\\/]node_modules[\\/](recharts|d3-[^/]+)[\\/]/,
                            chunks: 'all',
                            priority: 9,
                        },
                    },
                },
            };
        }
        return config;
    },
};

export default nextConfig;
