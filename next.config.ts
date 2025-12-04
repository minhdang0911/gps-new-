/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        optimizeCss: false,
    },
    compiler: {
        lightningcss: false,
    },

    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    { key: 'X-Content-Type-Options', value: 'nosniff' },

                    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },

                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },

                    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },

                    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },

                    {
                        key: 'Content-Security-Policy',
                        value:
                            "default-src 'self'; " +
                            "img-src 'self' data: https:; " +
                            "script-src 'self' 'unsafe-inline' https:; " +
                            "style-src 'self' 'unsafe-inline' https:; " +
                            "connect-src 'self' https:; " +
                            "frame-ancestors 'self';",
                    },
                ],
            },
        ];
    },
};

export default nextConfig;
