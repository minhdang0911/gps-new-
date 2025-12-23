'use client';

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

const sameArray = (a = [], b = []) => a.length === b.length && a.every((x, i) => x === b[i]);

function safeParseArray(raw) {
    try {
        const v = JSON.parse(raw);
        return Array.isArray(v) ? v : null;
    } catch {
        return null;
    }
}

/** Tính order cuối cùng từ allKeys + lockedKeys + localStorage */
function computeOrder({ storageKey, allKeys, lockedKeys }) {
    const locked = allKeys.filter((k) => lockedKeys.includes(k));
    const rest = allKeys.filter((k) => !lockedKeys.includes(k));
    const fallback = [...locked, ...rest];

    if (typeof window === 'undefined') return fallback;

    const raw = localStorage.getItem(storageKey);
    const saved = raw ? safeParseArray(raw) : null;

    if (!saved) return fallback;

    // chỉ lấy key hợp lệ
    const cleaned = saved.filter((k) => allKeys.includes(k));

    // locked luôn đứng đầu
    let next = [...locked, ...cleaned.filter((k) => !lockedKeys.includes(k))];

    // append cột mới
    const missing = allKeys.filter((k) => !next.includes(k));
    next = [...next, ...missing];

    if (!next.length) return fallback;
    return next;
}

/** Subscribe storage đúng chuẩn external store */
function useStorageSignal(storageKey) {
    return useSyncExternalStore(
        (cb) => {
            if (typeof window === 'undefined') return () => {};
            const onStorage = (e) => {
                if (!e || e.key === storageKey) cb();
            };
            window.addEventListener('storage', onStorage);
            return () => window.removeEventListener('storage', onStorage);
        },
        () => {
            if (typeof window === 'undefined') return 0;
            // snapshot chỉ cần thay đổi khi storage thay đổi
            return localStorage.getItem(storageKey) ?? '';
        },
        () => '',
    );
}

/**
 * allColsMeta: [{ key, label, column }]
 * lockedKeys: keys luôn hiển thị & luôn ở đầu (vd: ['index'])
 */
export function useReportColumns({ storageKey, allColsMeta, lockedKeys = ['index'] }) {
    // keys ổn định
    const allKeys = useMemo(() => allColsMeta.map((c) => c.key), [allColsMeta]);
    const lockedKeysStable = useMemo(() => lockedKeys, [lockedKeys.join('|')]); // tránh array ref đổi liên tục

    // 👇 signal sẽ đổi khi localStorage key đổi (tab khác)
    const storageSnapshot = useStorageSignal(storageKey);

    // ✅ init state bằng lazy initializer (KHÔNG dùng effect để init)
    const [visibleOrder, setVisibleOrder] = useState(() =>
        computeOrder({ storageKey, allKeys, lockedKeys: lockedKeysStable }),
    );

    // ✅ Recompute khi: đổi report (storageKey), đổi allKeys, đổi lockedKeys, hoặc storage thay đổi (external)
    useEffect(() => {
        const next = computeOrder({ storageKey, allKeys, lockedKeys: lockedKeysStable });
        setVisibleOrder((prev) => (sameArray(prev, next) ? prev : next));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [storageKey, storageSnapshot, allKeys.join('|'), lockedKeysStable.join('|')]);

    const allColsForModal = useMemo(() => allColsMeta.map((c) => ({ key: c.key, label: c.label })), [allColsMeta]);

    const columns = useMemo(() => {
        const map = new Map(allColsMeta.map((c) => [c.key, c.column]));
        return visibleOrder.map((k) => map.get(k)).filter(Boolean);
    }, [allColsMeta, visibleOrder]);

    const persist = useCallback(
        (nextOrder) => {
            try {
                localStorage.setItem(storageKey, JSON.stringify(nextOrder));
                window.dispatchEvent(new StorageEvent('storage', { key: storageKey }));
            } catch {}
        },
        [storageKey],
    );

    return {
        columns,
        visibleOrder,
        setVisibleOrder,
        allColsForModal,
        persist,
    };
}
