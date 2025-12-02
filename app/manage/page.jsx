'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function ManageIndexPage() {
    const router = useRouter();
    const pathname = usePathname() || '';

    useEffect(() => {
        // detect EN theo URL
        const segments = pathname.split('/').filter(Boolean);
        const last = segments[segments.length - 1];
        const isEn = last === 'en';

        const suffix = isEn ? '/en' : '';

        router.replace(`/manage/devices${suffix}`);
    }, [pathname, router]);

    return null;
}
