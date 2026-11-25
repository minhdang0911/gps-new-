// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // Chỉ can thiệp nếu trong pathname có segment 'en'
    if (pathname.includes('/en')) {
        const segments = pathname.split('/').filter(Boolean);
        const enIndex = segments.indexOf('en');

        if (enIndex !== -1) {
            const baseSegments = segments.filter((seg) => seg !== 'en');
            const basePath = baseSegments.length ? '/' + baseSegments.join('/') : '/';

            const url = req.nextUrl.clone();
            url.pathname = basePath;
            url.searchParams.set('lang', 'en');

            return NextResponse.rewrite(url);
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Khớp tất cả các đường dẫn TRỪ:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico, logo, media
         * - api routes
         */
        '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
