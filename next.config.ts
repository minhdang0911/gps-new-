/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        optimizeCss: false,
    },
    // BẮT BUỘC: tắt toàn bộ LightningCSS
    compiler: {
        lightningcss: false,
    },
};

export default nextConfig;
