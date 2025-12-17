import { useMemo, useState } from 'react';

export function useLangFromPath(pathname = '/') {
    const isEnFromPath = useMemo(() => {
        const segments = String(pathname).split('/').filter(Boolean);
        const last = segments[segments.length - 1];
        return last === 'en';
    }, [pathname]);

    // Tính giá trị derived từ path và localStorage
    const computedIsEn = useMemo(() => {
        if (typeof window === 'undefined') return false;

        if (isEnFromPath) {
            return true;
        }

        const saved = localStorage.getItem('iky_lang');
        return saved === 'en';
    }, [isEnFromPath]);

    const [isEn, setIsEn] = useState(computedIsEn);

    // Sync state trong render phase (không phải effect)
    if (isEn !== computedIsEn) {
        setIsEn(computedIsEn);

        // Sync localStorage khi path có 'en'
        if (typeof window !== 'undefined' && isEnFromPath) {
            localStorage.setItem('iky_lang', 'en');
        }
    }

    return { isEn };
}
