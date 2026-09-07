'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useSyncExternalStore } from 'react';

/**
 * useLang — Tập trung detect ngôn ngữ hiện tại (vi/en)
 *
 * Ưu tiên:
 *  1. Nếu pathname kết thúc bằng "/en" → English
 *  2. Nếu localStorage 'iky_lang' === 'en' → English
 *  3. Mặc định → Vietnamese
 *
 * Đồng bộ với localStorage qua useSyncExternalStore (không cần useEffect/setState).
 * @returns {'vi' | 'en'}
 */
export function useLang() {
    const pathname = usePathname() || '/';

    // Đọc localStorage reactive (cập nhật ngay khi tab khác đổi lang)
    const langFromStorage = useSyncExternalStore(
        (cb) => {
            if (typeof window === 'undefined') return () => {};
            const handler = (e) => {
                if (!e || e.key === 'iky_lang') cb();
            };
            window.addEventListener('storage', handler);
            return () => window.removeEventListener('storage', handler);
        },
        () => (typeof window !== 'undefined' ? (localStorage.getItem('iky_lang') ?? 'vi') : 'vi'),
        () => 'vi',
    );

    return useMemo(() => {
        const segments = pathname.split('/').filter(Boolean);
        const isEnFromPath = segments[segments.length - 1] === 'en';

        if (isEnFromPath) {
            // Side-effect: đồng bộ localStorage khi navigate qua URL
            if (typeof window !== 'undefined') {
                try { localStorage.setItem('iky_lang', 'en'); } catch {}
            }
            return 'en';
        }

        return langFromStorage === 'en' ? 'en' : 'vi';
    }, [pathname, langFromStorage]);
}

/**
 * useIsEn — Shorthand boolean
 * @returns {boolean}
 */
export function useIsEn() {
    return useLang() === 'en';
}
