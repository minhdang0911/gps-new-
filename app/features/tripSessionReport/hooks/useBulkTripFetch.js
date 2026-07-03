// features/tripSessionReport/hooks/useBulkTripFetch.js
//
// ✅ Parallel chunked fetch — không dùng total từ BE (thường sai).
//    Stop condition: khi 1 page trả về items.length < chunkSize → đó là page cuối.
//
//    Với 93,964 records, chunkSize=2000, concurrent=10:
//      Batch 1: pages  1–10 → 20k records (~300ms)
//      Batch 2: pages 11–20 → 20k records (~300ms)
//      Batch 3: pages 21–30 → 20k records (~300ms)
//      Batch 4: pages 31–40 → 20k records (~300ms)
//      Batch 5: pages 41–47 → last page  (~300ms)
//      Total: ~1.5s vs 14s (limit=9_999_999)
//
//    Module-level in-memory cache (TTL = 5 min, key = stable filter JSON)
//    force=true → bypass cache ("Làm mới")

import { useCallback, useRef, useState } from 'react';

const CHUNK_SIZE     = 2000;
const MAX_CONCURRENT = 10;

// ── Module-level cache ────────────────────────────────────────────
const CACHE     = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function stableStringify(obj) {
    if (!obj) return '';
    const keys = [];
    JSON.stringify(obj, (k, v) => { keys.push(k); return v; });
    keys.sort();
    return JSON.stringify(obj, keys);
}

function pickData(res) {
    return res?.data ?? res?.devices ?? res?.items ?? [];
}

function getCached(key) {
    const entry = CACHE.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL) {
        CACHE.delete(key);
        return null;
    }
    return entry;
}

function setCached(key, data) {
    CACHE.set(key, { data, total: data.length, timestamp: Date.now() });
}

export function invalidateTripCache(key) {
    if (key !== undefined) CACHE.delete(key);
    else CACHE.clear();
}

// ── Core parallel fetcher ─────────────────────────────────────────
// Stop condition: page trả về items.length < chunkSize → đó là page cuối.
// KHÔNG dùng total từ BE (thường không đáng tin).
async function fetchAllParallel({
    filterParams,
    apiFn,
    chunkSize,
    maxConcurrent,
    onProgress,
    cancelRef,
}) {
    // Phase 1: Fetch page 1 để lấy data đầu + detect trường hợp ít data
    const first     = await apiFn({ ...filterParams, page: 1, limit: chunkSize });
    if (cancelRef.current) return null;

    const firstData = Array.isArray(pickData(first)) ? pickData(first) : [];
    const allData   = [...firstData];

    onProgress({ loaded: allData.length });

    // Nếu page 1 đã ít hơn chunkSize → đây là tất cả data
    if (firstData.length < chunkSize) {
        return { data: allData, total: allData.length };
    }

    // Phase 2: Fetch batch song song, dừng khi gặp page cuối
    let nextPage = 2;
    let isDone   = false;

    while (!isDone && !cancelRef.current) {
        const batch = Array.from({ length: maxConcurrent }, (_, i) => nextPage + i);
        nextPage += maxConcurrent;

        const results = await Promise.allSettled(
            batch.map((p) => apiFn({ ...filterParams, page: p, limit: chunkSize })),
        );

        if (cancelRef.current) return null;

        for (const result of results) {
            if (result.status !== 'fulfilled') continue;

            const items = Array.isArray(pickData(result.value)) ? pickData(result.value) : [];
            if (items.length > 0) allData.push(...items);

            // Page cuối: trả về ít hơn chunkSize records
            if (items.length < chunkSize) {
                isDone = true;
                break;
            }
        }

        onProgress({ loaded: allData.length });
    }

    return { data: allData, total: allData.length };
}

// ── Hook ──────────────────────────────────────────────────────────
export function useBulkTripFetch({
    getTripSessions,
    chunkSize     = CHUNK_SIZE,
    maxConcurrent = MAX_CONCURRENT,
}) {
    const [allData,  setAllData]  = useState([]);
    const [loading,  setLoading]  = useState(false);
    // progress.total = 0 khi chưa biết tổng (parallel fetch)
    // → UI hiển thị "Đang tải... X records" thay vì %
    const [progress, setProgress] = useState({ loaded: 0, total: 0, percent: 0 });

    const cancelRef = useRef(false);

    const updateProgress = useCallback(({ loaded }) => {
        setProgress({ loaded, total: 0, percent: 0 });
    }, []);

    const fetchAll = useCallback(
        async (filterParams, { force = false } = {}) => {
            const key = stableStringify(filterParams);

            // ── Cache hit ────────────────────────────────────────
            if (!force) {
                const cached = getCached(key);
                if (cached) {
                    setAllData(cached.data);
                    setProgress({ loaded: cached.total, total: cached.total, percent: 100 });
                    return;
                }
            } else {
                invalidateTripCache(key);
            }

            // ── Fresh fetch ──────────────────────────────────────
            cancelRef.current = false;
            setLoading(true);
            setAllData([]);
            setProgress({ loaded: 0, total: 0, percent: 0 });

            try {
                const result = await fetchAllParallel({
                    filterParams,
                    apiFn:          getTripSessions,
                    chunkSize,
                    maxConcurrent,
                    onProgress:     updateProgress,
                    cancelRef,
                });

                if (result && !cancelRef.current) {
                    setCached(key, result.data);
                    setAllData(result.data);
                    setProgress({ loaded: result.total, total: result.total, percent: 100 });
                }
            } catch (err) {
                console.error('[useBulkTripFetch] error:', err);
            } finally {
                if (!cancelRef.current) setLoading(false);
            }
        },
        [getTripSessions, chunkSize, maxConcurrent, updateProgress],
    );

    const refresh = useCallback(
        (filterParams) => fetchAll(filterParams, { force: true }),
        [fetchAll],
    );

    const cancel = useCallback(() => {
        cancelRef.current = true;
        setLoading(false);
    }, []);

    return { allData, loading, progress, fetchAll, refresh, cancel };
}
