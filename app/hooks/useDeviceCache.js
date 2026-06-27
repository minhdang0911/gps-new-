'use client';
/**
 * useDeviceCache — Shared IndexedDB device list cache
 * ─────────────────────────────────────────────────────
 * Dùng chung toàn app: Monitor, Overview, Report, Manage
 * 
 * Strategy:
 *  1. Mount → đọc IndexedDB ngay (< 5ms) → hiện data cũ lập tức
 *  2. Nếu cache cũ hơn STALE_MS → fetch API trong background
 *  3. Update cache + state khi có data mới
 *  4. Nếu cache còn mới → skip API call hoàn toàn
 *
 * Result: tất cả pages chỉ gọi API 1 lần/5 phút dù navigate bao nhiêu lần
 */

import { useState, useEffect, useCallback } from 'react';
import { get, set } from 'idb-keyval';
import { getDevices } from '../lib/api/devices';

const CACHE_KEY    = 'iky_devices_v1';
const CACHE_TS_KEY = 'iky_devices_ts_v1';
const STALE_MS     = 5 * 60 * 1000; // 5 phút

// Module-level promise để tránh nhiều component cùng fetch cùng lúc
let _fetchPromise = null;

export function useDeviceCache({ limit = 200000 } = {}) {
    const [devices,  setDevices]  = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [cachedAt, setCachedAt] = useState(null);

    const fetchAndCache = useCallback(async (silent = false) => {
        // Nếu đang có fetch → đợi cái đó thay vì tạo request mới
        if (_fetchPromise) {
            const list = await _fetchPromise;
            setDevices(list);
            return list;
        }

        if (!silent) setLoading(true);

        _fetchPromise = getDevices({ limit })
            .then(res => res?.devices || [])
            .catch(err => {
                console.error('[useDeviceCache] fetch error:', err);
                return [];
            });

        try {
            const list = await _fetchPromise;
            const now  = Date.now();

            // Ghi IndexedDB
            await Promise.all([
                set(CACHE_KEY, list),
                set(CACHE_TS_KEY, now),
            ]);

            setDevices(list);
            setCachedAt(now);
            return list;
        } finally {
            _fetchPromise = null;
            setLoading(false);
        }
    }, [limit]);

    useEffect(() => {
        let cancelled = false;

        const init = async () => {
            // 1. Đọc cache ngay lập tức (< 5ms)
            const [cached, ts] = await Promise.all([
                get(CACHE_KEY),
                get(CACHE_TS_KEY),
            ]);

            if (cancelled) return;

            if (cached?.length) {
                setDevices(cached);
                setCachedAt(ts || 0);
                setLoading(false);

                // 2. Nếu cache còn mới → không cần fetch
                if (ts && Date.now() - ts < STALE_MS) return;

                // 3. Cache cũ → refetch silent trong background
                fetchAndCache(true);
            } else {
                // 4. Không có cache → fetch ngay
                fetchAndCache(false);
            }
        };

        init();
        return () => { cancelled = true; };
    }, [fetchAndCache]);

    const refresh = useCallback(() => fetchAndCache(false), [fetchAndCache]);

    return { devices, loading, cachedAt, refresh };
}
