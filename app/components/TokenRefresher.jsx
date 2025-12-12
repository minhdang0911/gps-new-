'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function TokenRefresher() {
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (!pathname || pathname.startsWith('/login')) return;

        const accessToken = localStorage.getItem('accessToken');
        const refreshToken = localStorage.getItem('refreshToken');

        if (!accessToken && !refreshToken) {
            localStorage.clear();
            router.replace('/login');
        }
    }, [pathname, router]);

    return null;
}
