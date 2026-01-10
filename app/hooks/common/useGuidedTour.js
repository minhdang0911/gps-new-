'use client';

import { useCallback } from 'react';

export function useGuidedTour({ isEn, enabled = true, steps = [] }) {
    const start = useCallback(async () => {
        if (typeof window === 'undefined') return;
        if (!enabled) return;

        try {
            const intro = (await import('intro.js')).default;

            // ✅ Filter step: selector phải tồn tại
            const safeSteps = (steps || []).filter((s) => {
                if (!s?.element) return false;
                return !!document.querySelector(s.element);
            });

            if (safeSteps.length === 0) return;

            intro()
                .setOptions({
                    exitOnOverlayClick: true,
                    nextLabel: isEn ? 'Next' : 'Tiếp',
                    prevLabel: isEn ? 'Back' : 'Lùi',
                    doneLabel: isEn ? 'Done' : 'Xong',
                    steps: safeSteps,
                })
                .start();
        } catch (e) {
            console.error(e);
        }
    }, [enabled, steps, isEn]);

    return { start };
}
