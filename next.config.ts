// /** @type {import('next').NextConfig} */
// const nextConfig = {
//     experimental: {
//         optimizeCss: false,
//     },
//     compiler: {
//         lightningcss: false,
//     },

//     async headers() {
//         return [
//             {
//                 source: "/(.*)",
//                 headers: [
//                     // Ngăn sniff MIME
//                     { key: "X-Content-Type-Options", value: "nosniff" },

//                     // Chống clickjacking
//                     { key: "X-Frame-Options", value: "SAMEORIGIN" },

//                     // Không lộ referrer lung tung
//                     { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

//                     // Chặn API nguy hiểm (web m ko cần camera/mic thì tắt hết)
//                     { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },

//                     // Ép dùng HTTPS mạnh
//                     { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },

//                     // CSP — CÁI NÀY QUAN TRỌNG NHẤT
//                     {
//                         key: "Content-Security-Policy",
//                         value:
//                             "default-src 'self'; " +
//                             "img-src 'self' data: https:; " +
//                             "script-src 'self' 'unsafe-inline' https:; " +
//                             "style-src 'self' 'unsafe-inline' https:; " +
//                             "connect-src 'self' https:; " +
//                             "frame-ancestors 'self';"
//                     }
//                 ]
//             }
//         ];
//     }
// };

// export default nextConfig;

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
