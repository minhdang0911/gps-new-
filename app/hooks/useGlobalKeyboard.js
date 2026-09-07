'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const NAV_SHORTCUTS = [
    { key: '1', path: '/' },
    { key: '2', path: '/cruise' },
    { key: '3', path: '/overview' },
    { key: '4', path: '/report/usage-session' },
    { key: '5', path: '/manage/devices' },
    { key: '6', path: '/support' },
];

/**
 * useGlobalKeyboard — Global keyboard shortcuts
 *
 * Navigation (Ctrl+1..6):
 *   Ctrl+1 → / (Monitor)
 *   Ctrl+2 → /cruise (Hành trình)
 *   Ctrl+3 → /overview (Tổng quan)
 *   Ctrl+4 → /report/usage-session (Báo cáo)
 *   Ctrl+5 → /manage/devices (Quản lý)
 *   Ctrl+6 → /support (Hỗ trợ)
 *
 * Không fire khi đang focus trong input/textarea/select/[contenteditable].
 * Mount 1 lần ở LayoutWrapper.
 */
export function useGlobalKeyboard() {
    const router = useRouter();

    useEffect(() => {
        const isInInput = () => {
            const el = document.activeElement;
            if (!el) return false;
            const tag = el.tagName.toLowerCase();
            return (
                tag === 'input' ||
                tag === 'textarea' ||
                tag === 'select' ||
                el.isContentEditable
            );
        };

        const onKeyDown = (e) => {
            // Bỏ qua khi đang nhập liệu
            if (isInInput()) return;

            const isCtrl = e.ctrlKey || e.metaKey;
            if (!isCtrl) return;

            // Ctrl+1..6 → navigate
            const shortcut = NAV_SHORTCUTS.find((s) => s.key === e.key);
            if (shortcut) {
                e.preventDefault();

                // Giữ nguyên /en suffix nếu đang dùng English
                const lang = typeof window !== 'undefined'
                    ? localStorage.getItem('iky_lang')
                    : 'vi';
                const suffix = lang === 'en' ? '/en' : '';
                const target = shortcut.path === '/'
                    ? (lang === 'en' ? '/en' : '/')
                    : `${shortcut.path}${suffix}`;

                router.push(target);
                return;
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [router]);
}
