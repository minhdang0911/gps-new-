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

        const proactiveRefresh = async () => {
            const refreshToken = localStorage.getItem('refreshToken');

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

                console.log('✅ Proactive refresh thành công');
            } catch (err) {
                console.error('❌ Proactive refresh thất bại:', err);
            }
        };

        const interval = setInterval(proactiveRefresh, 10 * 60 * 1000);

        const handleVisibilityChange = () => {
            if (!document.hidden) {
                // console.log('👀 User quay lại tab');
                proactiveRefresh();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [pathname, router]);

    return null;
}
