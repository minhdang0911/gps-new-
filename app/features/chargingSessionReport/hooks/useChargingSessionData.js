// features/chargingSessionReport/hooks/useChargingSessionData.js
//
// ✅ REFACTORED: Single large-limit fetch → ALL data → FE pagination
//    - 1 request với limit=9_999_999 → BE trả tất cả records
//    - Module-level in-memory cache (TTL = 5 min, key = stable filter JSON)
//    - force=true → bypass cache ("Làm mới")
//    - FE handles: pagination, sort, imei/plate filter

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildPayload } from '../utils';
import { useAuthStore } from '../../../stores/authStore';

const DEFAULT_PAGE_SIZE = 20;
const FETCH_ALL_LIMIT   = 9_999_999;

// ── Module-level cache (tách riêng với trip-session cache) ────────
const CACHE     = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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

function invalidateCache(key) {
    if (key !== undefined) CACHE.delete(key);
    else CACHE.clear();
}

// ✅ strip field FE-only mà BE không support
function stripUnsupportedParams(payload) {
    if (!payload || typeof payload !== 'object') return payload;
    const next = { ...payload };
    delete next.imei;
    delete next.license_plate;
    delete next.imeis;
    delete next.imeiText;
    delete next.plateText;
    return next;
}

// Build filter (không bao gồm page/limit)
function buildFilter({ values, plateToImeis }) {
    const payloadRaw = buildPayload({ values, page: 1, limit: 1, plateToImeis });
    const { page: _p, limit: _l, ...filter } = payloadRaw;
    return stripUnsupportedParams(filter);
}

// ── Main hook ─────────────────────────────────────────────────────
export function useChargingSessionData({
    form,
    getChargingSessions,
    isEn,
    t,
    imeiToPlate,
    plateToImeis,
    loadingDeviceMap,
    attachLicensePlate,
}) {
    const userId = useAuthStore((s) => s.user?._id) || 'guest';

    // ── Raw data (before attachLicensePlate) ─────────────────────
    const [rawAll,   setRawAll]   = useState([]);
    const [loading,  setLoading]  = useState(false);
    const [progress, setProgress] = useState({ loaded: 0, total: 0, percent: 0 });

    // ── FE sort ──────────────────────────────────────────────────
    const [sortMode, setSortMode] = useState('none');

    // ── FE pagination state ──────────────────────────────────────
    const [page,     setPage]     = useState(1);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

    const cancelRef = useRef(false);

    // ── Attach license plate ─────────────────────────────────────
    const serverData = useMemo(() => {
        try {
            if (!attachLicensePlate || !imeiToPlate || imeiToPlate.size === 0) return rawAll;
            return attachLicensePlate(rawAll, imeiToPlate);
        } catch (e) {
            console.error('[useChargingSessionData] attachLicensePlate error:', e);
            return rawAll;
        }
    }, [rawAll, imeiToPlate, attachLicensePlate]);

    // ── Pagination object ────────────────────────────────────────
    // total = serverData.length (FE handles total after fetch)
    // page.jsx thực ra đã tự slice theo feFilteredRows nên pagination.total
    // sẽ được override bởi useEffect trong page.jsx.
    const pagination = useMemo(() => ({
        current:  page,
        pageSize,
        total:    serverData.length,
    }), [page, pageSize, serverData.length]);

    const setPagination = useCallback((updater) => {
        const prev = { current: page, pageSize, total: serverData.length };
        const next = typeof updater === 'function' ? updater(prev) : updater;

        const newPage     = next.current  ?? page;
        const newPageSize = next.pageSize ?? pageSize;

        if (newPageSize !== pageSize) {
            setPageSize(newPageSize);
            setPage(1);
        } else if (newPage !== page) {
            setPage(newPage);
        }
    }, [page, pageSize, serverData.length]);

    // ── Core fetch: 1 request với limit cực lớn ─────────────────
    const fetchAll = useCallback(async ({ force = false } = {}) => {
        if (loadingDeviceMap) return;

        const values = form.getFieldsValue();
        const filter = buildFilter({ values, plateToImeis });
        const key    = stableStringify({ ...filter, userId });

        // Serve from cache
        if (!force) {
            const cached = getCached(key);
            if (cached) {
                setRawAll(cached.data);
                setProgress({ loaded: cached.total, total: cached.total, percent: 100 });
                return;
            }
        } else {
            invalidateCache(key);
        }

        // Fetch fresh
        cancelRef.current = false;
        setLoading(true);
        setRawAll([]);
        setProgress({ loaded: 0, total: 0, percent: 0 });

        try {
            const result = await getChargingSessions({
                ...filter,
                page:  1,
                limit: FETCH_ALL_LIMIT,
            });

            if (cancelRef.current) return;

            const rawData = pickData(result);
            const items   = Array.isArray(rawData) ? rawData : [];

            setCached(key, items);
            setRawAll(items);
            setProgress({ loaded: items.length, total: items.length, percent: 100 });
        } catch (err) {
            console.error('[useChargingSessionData] fetch error:', err);
        } finally {
            if (!cancelRef.current) setLoading(false);
        }
    }, [form, plateToImeis, getChargingSessions, loadingDeviceMap, userId]);

    // fetchPaged — alias for backward compat với page.jsx
    const fetchPaged = useCallback(
        (_page, _pageSize, opts) => fetchAll(opts),
        [fetchAll],
    );

    // ── Auto-load on mount (sau khi device map sẵn sàng) ─────────
    useEffect(() => {
        if (loadingDeviceMap) return;
        fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadingDeviceMap, userId]);

    return {
        serverData,
        fullData:     serverData,   // compat: page.jsx dùng fullData làm baseRows
        loading:      loading || loadingDeviceMap,
        progress,                  // { loaded, total, percent } — cho progress bar
        pagination,
        setPagination,
        sortMode,
        setSortMode,
        needFullData: true,        // luôn dùng FE pagination + FE filter
        fetchPaged,                // alias → fetchAll (backward compat)
        fetchAll,                  // real fetch fn (gọi khi search/refresh)
        mutate:       () => {},    // no-op
    };
}
