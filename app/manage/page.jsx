'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function ManageIndexPage() {
    const router = useRouter();
    const pathname = usePathname() || '';

    useEffect(() => {
        // Chỉ chạy khi đang ở đúng trang /manage hoặc /manage/en
        // Tránh redirect loop khi đã ở /manage/devices
        const segments = pathname.split('/').filter(Boolean);

        // Nếu pathname đã có "devices" thì không redirect nữa
        if (segments.includes('devices')) return;

        const isEn = segments.includes('en');
        const suffix = isEn ? '/en' : '';

        router.replace(`/manage/devices${suffix}`);
    }, [pathname]);

    return null;
}
