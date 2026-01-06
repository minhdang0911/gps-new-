'use client';

import { useSyncExternalStore } from 'react';

/** ✅ đọc localStorage “chuẩn React”, không cần useEffect + setState */
export function useLocalStorageValue(key, fallback = '') {
    const subscribe = (callback) => {
        if (typeof window === 'undefined') return () => {};
        const handler = (e) => {
            if (!e || e.key === key) callback();
        };
        window.addEventListener('storage', handler);
        return () => window.removeEventListener('storage', handler);
    };

    const getSnapshot = () => {
        if (typeof window === 'undefined') return fallback;
        return localStorage.getItem(key) ?? fallback;
    };

    const getServerSnapshot = () => fallback;

    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
