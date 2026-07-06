'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../stores/authStore';
import { resetDeviceCache } from './useDeviceCache';

const AUTH_STORAGE_KEYS = ['accessToken', 'refreshToken', 'role', 'iky_user'];

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
    const router = useRouter();
    const clearUser = useAuthStore((s) => s.clearUser);

    useEffect(() => {
        const handleForceLogout = async () => {
            // 1. Xoá Zustand store
            clearUser();

            // 2. Xoá IndexedDB device cache (tránh data user cũ bị giữ lại)
            await resetDeviceCache();

            // 3. Xoá tất cả auth keys trong localStorage
            AUTH_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));

            // 4. Điều hướng bằng router → không reload trang, giữ React state
            router.push('/login');
        };

        window.addEventListener('auth:logout', handleForceLogout);
        return () => window.removeEventListener('auth:logout', handleForceLogout);
    }, [router, clearUser]);
}
