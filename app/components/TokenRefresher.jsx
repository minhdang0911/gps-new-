'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { refreshTokenApi } from '../lib/api/auth';

export default function TokenRefresher() {
    const router = useRouter();

    useEffect(() => {
        document.title = 'Quản lý xe';
    }, []);

    useEffect(() => {
        const interval = setInterval(async () => {
            const accessToken = localStorage.getItem('accessToken');
            const refreshToken = localStorage.getItem('refreshToken');

            // ❌ Không có token → về login
            if (!accessToken || !refreshToken) {
                localStorage.clear();
                router.replace('/login');
                return;
            }

            try {
                const res = await refreshTokenApi(refreshToken, accessToken);

                localStorage.setItem('accessToken', res.accessToken);
                localStorage.setItem('refreshToken', res.refreshToken);
                console.log('🔄 Token refreshed!');
            } catch (err) {
                console.error('Refresh failed:', err);
                localStorage.clear();
                router.replace('/login');
            }
        }, 5 * 60 * 1000); // 5 phút 1 lần

        return () => clearInterval(interval);
    }, [router]);

    return null;
}
