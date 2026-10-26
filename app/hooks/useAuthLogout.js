'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../stores/authStore';
import { resetDeviceCache } from './useDeviceCache';
import { hasSecureSession, clearSecureSession } from '../lib/auth/secureSession';

/**
 * useAuthLogout — Lắng nghe event 'auth:logout' từ axios interceptor
 *
 * Khi token hết hạn và không thể refresh, axios dispatch CustomEvent thay vì
 * dùng window.location.href (gây full page reload, mất React state).
 *
 * Hook này bridge giữa axios (non-React) và Next.js router.
 * Mount 1 lần duy nhất tại LayoutWrapper.
 */
export function useAuthLogout() {
    const router   = useRouter();
    const clearAll = useAuthStore((s) => s.clearAll);

    useEffect(() => {
        const handleForceLogout = async () => {
            // Guard chống văng: nếu còn Secure Session hợp lệ (chưa bấm Đăng xuất) -> KHÔNG đá về login
            if (hasSecureSession()) {
                console.warn('[useAuthLogout] Force logout prevented — active secure session exists');
                return;
            }

            // 1. Xoá toàn bộ auth state (Zustand persist tự xóa localStorage tokens)
            clearAll();
            clearSecureSession();

            // 2. Xoá IndexedDB device cache
            await resetDeviceCache();

            // 3. Xóa các key khác không nằm trong store
            if (typeof window !== 'undefined') {
                localStorage.removeItem('role');
                localStorage.removeItem('currentUser');
            }

            // 4. Redirect về login
            router.push('/login');
        };

        window.addEventListener('auth:logout', handleForceLogout);
        return () => window.removeEventListener('auth:logout', handleForceLogout);
    }, [router, clearAll]);
}
