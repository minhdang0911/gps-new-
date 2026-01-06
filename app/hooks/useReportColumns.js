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

/** ✅ TRIỆT ĐỂ: saved là visibleOrder thật sự (ẩn là mất khỏi array) */
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
    const next = [...locked, ...cleaned.filter((k) => !lockedKeys.includes(k))];

    // ✅ KHÔNG append missing nữa (missing = cột user đã ẩn)
    return next.length ? next : fallback;
}

/** Cross-tab signal (tab khác chỉnh thì tab này update) */
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
            if (typeof window === 'undefined') return '';
            return localStorage.getItem(storageKey) ?? '';
        },
        () => '',
    );
}

export function useReportColumns({ storageKey, allColsMeta, lockedKeys = ['index'] }) {
    const allKeys = useMemo(() => allColsMeta.map((c) => c.key), [allColsMeta]);
    const lockedStable = useMemo(() => lockedKeys, [lockedKeys.join('|')]);

    const storageSnapshot = useStorageSignal(storageKey);

    const [visibleOrder, _setVisibleOrder] = useState(() =>
        computeOrder({ storageKey, allKeys, lockedKeys: lockedStable }),
    );

    // nếu tab khác đổi localStorage -> sync vào state
    useEffect(() => {
        const next = computeOrder({ storageKey, allKeys, lockedKeys: lockedStable });
        _setVisibleOrder((prev) => (sameArray(prev, next) ? prev : next));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [storageKey, storageSnapshot, allKeys.join('|'), lockedStable.join('|')]);

    const persist = useCallback(
        (nextOrder) => {
            try {
                localStorage.setItem(storageKey, JSON.stringify(nextOrder));
            } catch (e) {
                console.error('Persist column error', e);
            }
        },
        [storageKey],
    );

    /**
     * ✅ TRIỆT ĐỂ: set state + persist 1 chỗ
     * - nhận được cả value lẫn updater function (giống react setState)
     */
    const setVisibleOrder = useCallback(
        (next) => {
            _setVisibleOrder((prev) => {
                const resolved = typeof next === 'function' ? next(prev) : next;
                if (!sameArray(prev, resolved)) persist(resolved);
                return resolved;
            });
        },
        [persist],
    );

    const allColsForModal = useMemo(() => allColsMeta.map((c) => ({ key: c.key, label: c.label })), [allColsMeta]);

    const columns = useMemo(() => {
        const map = new Map(allColsMeta.map((c) => [c.key, c.column]));
        return visibleOrder.map((k) => map.get(k)).filter(Boolean);
    }, [allColsMeta, visibleOrder]);

    return {
        columns,
        visibleOrder,
        setVisibleOrder, // ✅ đã auto persist rồi
        allColsForModal,
        persist, // vẫn expose nếu bạn muốn dùng
    };
}
