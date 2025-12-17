import { useMemo, useState } from 'react';

export function useLangFromPath(pathname) {
    const isEnFromPath = useMemo(() => {
        const segments = (pathname || '/').split('/').filter(Boolean);
        return segments[segments.length - 1] === 'en';
    }, [pathname]);

    // Compute derived state từ isEnFromPath
    const computedIsEn = useMemo(() => {
        if (typeof window === 'undefined') return false;
        if (isEnFromPath) return true;
        return localStorage.getItem('iky_lang') === 'en';
    }, [isEnFromPath]);

    // State để có thể thay đổi sau này nếu cần
    const [isEn, setIsEn] = useState(computedIsEn);

    // Sync state khi computedIsEn thay đổi (render-time update)
    if (isEn !== computedIsEn) {
        setIsEn(computedIsEn);
        if (typeof window !== 'undefined' && computedIsEn) {
            localStorage.setItem('iky_lang', 'en');
        }
    }

    return { isEn };
}
