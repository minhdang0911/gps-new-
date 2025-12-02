'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function ReportHomePage() {
    const router = useRouter();
    const pathname = usePathname() || '';

    useEffect(() => {
        // ['/','report','en'] hoặc ['/','report']...
        const segments = pathname.split('/').filter(Boolean);
        const last = segments[segments.length - 1];
        const isEn = last === 'en';
        const suffix = isEn ? '/en' : '';

        router.replace(`/report/usage-session${suffix}`);
    }, [pathname, router]);

    return null;
}
