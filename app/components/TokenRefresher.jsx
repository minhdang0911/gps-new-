'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { refreshTokenApi } from '../lib/api/auth';

export default function TokenRefresher() {
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        document.title = 'Quản lý xe';
    }, []);

    useEffect(() => {
        // không check token ở trang login
        if (pathname === '/login') return;

        const checkAndRefresh = async () => {
            const accessToken = localStorage.getItem('accessToken');
            const refreshToken = localStorage.getItem('refreshToken');

            if (!accessToken || !refreshToken) {
                localStorage.clear();
                router.replace('/login');
                return;
            }

            try {
                const res = await refreshTokenApi(refreshToken, accessToken);

                // refresh OK
                localStorage.setItem('accessToken', res.accessToken);
                localStorage.setItem('refreshToken', res.refreshToken);
                console.log('🔄 Token refreshed!');
            } catch (err) {
                console.error('Refresh failed:', err);

                localStorage.clear();
                router.replace('/login');
            }
        };

        checkAndRefresh();

        const interval = setInterval(checkAndRefresh, 5 * 60 * 1000);

        return () => clearInterval(interval);
    }, [pathname, router]);

    return null;
}
