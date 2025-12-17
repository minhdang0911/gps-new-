'use client';

import { useEffect, useMemo, useState } from 'react';

const sameArray = (a = [], b = []) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * allColsMeta: [{ key, label, column }]
 * lockedKeys: keys luôn hiển thị & luôn ở đầu (vd: ['index'])
 */
export function useReportColumns({ storageKey, allColsMeta, lockedKeys = ['index'] }) {
    const [visibleOrder, setVisibleOrder] = useState([]);

    // Chỉ phụ thuộc danh sách keys để tránh re-init theo object reference
    const allKeys = useMemo(() => allColsMeta.map((c) => c.key), [allColsMeta]);
    const allKeysKey = useMemo(() => allKeys.join('|'), [allKeys]);

    // lockedKeysKey ổn định (tránh ['index'] tạo mới mỗi render)
    const lockedKeysKey = useMemo(() => lockedKeys.join('|'), [lockedKeys]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const locked = allKeys.filter((k) => lockedKeys.includes(k));
        const rest = allKeys.filter((k) => !lockedKeys.includes(k));
        const fallback = [...locked, ...rest];

        let next = fallback;

        try {
            const raw = localStorage.getItem(storageKey);
            if (raw) {
                const saved = JSON.parse(raw);
                if (Array.isArray(saved)) {
                    // chỉ lấy key hợp lệ, giữ locked luôn đứng đầu
                    const cleaned = saved.filter((k) => allKeys.includes(k));
                    next = [...locked, ...cleaned.filter((k) => !lockedKeys.includes(k))];

                    // nếu saved thiếu cột mới => append vào cuối
                    const missing = allKeys.filter((k) => !next.includes(k));
                    next = [...next, ...missing];

                    if (!next.length) next = fallback;
                }
            }
        } catch {
            next = fallback;
        }

        // chống loop: chỉ setState nếu khác thật
        setVisibleOrder((prev) => (sameArray(prev, next) ? prev : next));
    }, [storageKey, allKeysKey, lockedKeysKey]);

    const allColsForModal = useMemo(() => allColsMeta.map((c) => ({ key: c.key, label: c.label })), [allColsMeta]);

    const columns = useMemo(() => {
        const map = new Map(allColsMeta.map((c) => [c.key, c.column]));
        return visibleOrder.map((k) => map.get(k)).filter(Boolean);
    }, [allColsMeta, visibleOrder]);

    const persist = (nextOrder) => {
        try {
            localStorage.setItem(storageKey, JSON.stringify(nextOrder));
        } catch {}
    };

    return {
        columns,
        visibleOrder,
        setVisibleOrder,
        allColsForModal,
        persist, // optional: nếu muốn lưu ngoài modal
    };
}
