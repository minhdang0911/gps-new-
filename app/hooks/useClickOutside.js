'use client';
import { useEffect } from 'react';

/**
 * useClickOutside — Hook phát hiện click ngoài element
 * ─────────────────────────────────────────────────────
 * Dùng chung cho dropdown, popover, panel…
 * Thay vì viết lại document.addEventListener ở mỗi component.
 *
 * @param {React.RefObject} ref    — ref đến container element
 * @param {Function}        handler — callback khi click ngoài
 * @param {boolean}         active  — chỉ listen khi active (default: true)
 */
export function useClickOutside(ref, handler, active = true) {
    useEffect(() => {
        if (!active) return;

        const listener = (e) => {
            // Không trigger nếu click vào bên trong ref element
            if (!ref.current || ref.current.contains(e.target)) return;
            handler(e);
        };

        document.addEventListener('mousedown', listener);
        document.addEventListener('touchstart', listener);

        return () => {
            document.removeEventListener('mousedown', listener);
            document.removeEventListener('touchstart', listener);
        };
    }, [ref, handler, active]);
}
