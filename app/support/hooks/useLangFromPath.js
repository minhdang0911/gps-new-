import { useEffect, useMemo } from 'react';

export function useLangFromPath(pathname) {
    const isEnFromPath = useMemo(() => {
        const segments = (pathname || '/').split('/').filter(Boolean);
        return segments[segments.length - 1] === 'en';
    }, [pathname]);

    const isEn = useMemo(() => {
        if (typeof window === 'undefined') return false; // SSR fallback
        if (isEnFromPath) return true;
        return localStorage.getItem('iky_lang') === 'en';
    }, [isEnFromPath]);

    // chỉ sync external system (localStorage) => đúng mục đích effect
    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (isEnFromPath) localStorage.setItem('iky_lang', 'en');
    }, [isEnFromPath]);

    return isEn;
}
