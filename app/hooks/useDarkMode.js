'use client';

import { useCallback, useSyncExternalStore } from 'react';

const LS_KEY = 'iky_theme';
const DARK_CLASS = 'iky-dark';

function getSnapshot() {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(LS_KEY) === 'dark';
}

function getServerSnapshot() {
    return false;
}

const subscribers = new Set();

function subscribe(cb) {
    subscribers.add(cb);
    return () => subscribers.delete(cb);
}

function notify() {
    subscribers.forEach((cb) => cb());
}

function applyTheme(isDark) {
    if (typeof document === 'undefined') return;
    if (isDark) {
        document.documentElement.classList.add(DARK_CLASS);
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.classList.remove(DARK_CLASS);
        document.documentElement.setAttribute('data-theme', 'light');
    }
}

// Khởi tạo theme ngay khi module load (tránh flash)
if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(LS_KEY);
    applyTheme(saved === 'dark');
}

/**
 * useDarkMode — Dark/light mode toggle
 *
 * Dùng useSyncExternalStore để reactive với localStorage.
 * Apply class 'iky-dark' lên <html> → Ant Design ConfigProvider đọc từ context.
 *
 * @returns {{ isDark: boolean, toggle: () => void, setDark: (v: boolean) => void }}
 */
export function useDarkMode() {
    const isDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    const setDark = useCallback((value) => {
        if (typeof window === 'undefined') return;
        localStorage.setItem(LS_KEY, value ? 'dark' : 'light');
        applyTheme(value);
        notify();
    }, []);

    const toggle = useCallback(() => {
        setDark(!getSnapshot());
    }, [setDark]);

    return { isDark, toggle, setDark };
}

/**
 * useDarkModeValue — Chỉ đọc giá trị, không expose toggle
 * @returns {boolean}
 */
export function useDarkModeValue() {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
