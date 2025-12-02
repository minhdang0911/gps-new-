// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
    const url = req.nextUrl.clone();
    const segments = url.pathname.split('/').filter(Boolean);

    // không có segment nào thì thôi
    if (segments.length === 0) {
        return NextResponse.next();
    }

    // Tìm xem có 'en' ở đâu trong path
    const enIndex = segments.indexOf('en');

    if (enIndex !== -1) {
        // Loại bỏ 'en' khỏi segments để tạo path gốc
        const baseSegments = segments.filter((seg) => seg !== 'en');
        const basePath = baseSegments.length ? '/' + baseSegments.join('/') : '/';

        url.pathname = basePath; // thực sự render path gốc
        url.searchParams.set('lang', 'en'); // gắn lang=en cho FE xài

        return NextResponse.rewrite(url);
    }

    return NextResponse.next();
}
