'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { refreshTokenApi } from '../lib/api/auth';

export default function TokenRefresher() {
    const router = useRouter();
    const pathname = usePathname();
    const startedRef = useRef(false);

    useEffect(() => {
        if (pathname === '/login') return;

        if (startedRef.current) return;
        startedRef.current = true;

        const checkAndRefresh = async () => {
            const refreshToken = localStorage.getItem('refreshToken');

            // Không có refreshToken -> coi như hết phiên, bắt login lại
            if (!refreshToken) {
                localStorage.clear();
                router.replace('/login');
                return;
            }

            try {
                const res = await refreshTokenApi(refreshToken);

                if (res.accessToken) {
                    localStorage.setItem('accessToken', res.accessToken);
                }
                if (res.refreshToken) {
                    localStorage.setItem('refreshToken', res.refreshToken);
                }

                console.log('🔄 Token refreshed!');
            } catch (err) {
                console.error('Refresh failed:', err);
                localStorage.clear();
                router.replace('/login');
            }
        };

        // Gọi 1 lần khi load
        checkAndRefresh();

        // Rồi 5p refresh 1 lần
        const interval = setInterval(checkAndRefresh, 5 * 60 * 1000);

        return () => clearInterval(interval);
    }, [pathname, router]);

    return null;
}
