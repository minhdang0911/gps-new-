'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { refreshTokenApi } from '../lib/api/auth';

export default function TokenRefresher() {
    const router = useRouter();
    const pathname = usePathname();
    const startedRef = useRef(false);

    useEffect(() => {
        // Nếu đang ở trang login thì không check
        if (pathname === '/login' || pathname === '/login/en') return;

        // 🔥 CHECK TOKEN NGAY KHI VÀO TRANG
        const checkTokenOnMount = async () => {
            const accessToken = localStorage.getItem('accessToken');
            const refreshToken = localStorage.getItem('refreshToken');

            // Không có token → redirect ngay
            if (!accessToken && !refreshToken) {
                console.log('❌ Không có token, redirect về login');
                localStorage.clear();
                router.replace('/login');
                return false;
            }

            // Có refreshToken → thử refresh để verify
            if (refreshToken) {
                try {
                    const res = await refreshTokenApi(refreshToken);

                    if (res.accessToken) {
                        localStorage.setItem('accessToken', res.accessToken);
                    }
                    if (res.refreshToken) {
                        localStorage.setItem('refreshToken', res.refreshToken);
                    }

                    console.log('✅ Token hợp lệ');
                    return true;
                } catch (err) {
                    console.error('❌ Token không hợp lệ, redirect về login');
                    localStorage.clear();
                    router.replace('/login');
                    return false;
                }
            }

            return true;
        };

        // Chỉ chạy 1 lần
        if (startedRef.current) return;
        startedRef.current = true;

        // Check token ngay lập tức
        checkTokenOnMount().then((isValid) => {
            if (!isValid) return;

            // Nếu token hợp lệ → setup refresh định kỳ
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
                    localStorage.clear();
                    router.replace('/login');
                }
            };

            const interval = setInterval(proactiveRefresh, 10 * 60 * 1000);

            const handleVisibilityChange = () => {
                if (!document.hidden) {
                    proactiveRefresh();
                }
            };

            document.addEventListener('visibilitychange', handleVisibilityChange);

            return () => {
                clearInterval(interval);
                document.removeEventListener('visibilitychange', handleVisibilityChange);
            };
        });
    }, [pathname, router]);

    return null;
}
