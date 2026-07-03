import { useEffect, useMemo, useState, useCallback } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { buildParams } from '../utils';

// ✅ REFACTORED: True server-side pagination
// Xóa hoàn toàn needFullData (fetch 300K) và dual-SWR pattern.
// Mỗi lần chuyển trang / filter → gọi API với page + limit thực sự.

const DEFAULT_PAGE_SIZE = 20;

function stableStringify(obj) {
    if (!obj) return '';
    const allKeys = [];
    JSON.stringify(obj, (key, value) => { allKeys.push(key); return value; });
    allKeys.sort();
    return JSON.stringify(obj, allKeys);
}

function makeKey(prefix, params) {
    return params !== null ? [prefix, stableStringify(params)] : null;
}

function pickData(res) {
    return res?.data || res?.devices || res?.items || [];
}

function pickTotal(res) {
    return res?.total ?? res?.totalRecords ?? res?.count ?? null;
}

// Build filter params (NO page/limit)
function buildFilter(values) {
    const p = buildParams(values, 1, 1); // page/limit dummy, sẽ bị override
    const { page: _p, limit: _l, ...filter } = p;
    return filter;
}

export function useUsageSessionData({ form, getUsageSessions, isEn, t }) {
    const { mutate: globalMutate } = useSWRConfig();

    // ── Server-side pagination state ───────────────────────────────
    const [page, setPage]               = useState(1);
    const [pageSize, setPageSize]       = useState(DEFAULT_PAGE_SIZE);
    const [totalFromBE, setTotalFromBE] = useState(0);

    // ── FE sort (within current page only) ────────────────────────
    const [sortMode, setSortMode]       = useState('none');
    const [tableFilters, setTableFilters] = useState({ vehicleId: null, batteryId: null });
    const [groupBy, setGroupBy]         = useState('none');

    // ── Filter payload (no page/limit) ────────────────────────────
    const [filterPayload, setFilterPayload] = useState(null);

    // ── SWR key = filter + page + pageSize ────────────────────────
    const swrKey = useMemo(() => {
        if (filterPayload === null) return null;
        return makeKey('usageSessions:v2', { ...filterPayload, page, limit: pageSize });
    }, [filterPayload, page, pageSize]);

    const fetcher = useCallback(
        async (key) => {
            if (!key) return null;
            const [, paramsJson] = key;
            return getUsageSessions(paramsJson ? JSON.parse(paramsJson) : {});
        },
        [getUsageSessions],
    );

    const swrOpt = useMemo(() => ({
        revalidateOnFocus:     false,
        revalidateOnReconnect: false,
        revalidateIfStale:     false,
        keepPreviousData:      true,
        dedupingInterval:      30_000,
        shouldRetryOnError:    false,
    }), []);

    const swr = useSWR(swrKey, fetcher, swrOpt);
    const loading = swr.isLoading || swr.isValidating;

    // ── Extract current page data ──────────────────────────────────
    const serverData = useMemo(() => pickData(swr.data) || [], [swr.data]);
    // compat: các page.jsx vẫn có thể dùng fullData
    const fullData = serverData;

    // ── Sync total from BE ─────────────────────────────────────────
    useEffect(() => {
        const t = pickTotal(swr.data);
        if (t != null) setTotalFromBE(Number(t));
    }, [swr.data]);

    // ── Update total (compat) ──────────────────────────────────────
    useEffect(() => {
        const t = pickTotal(swr.data);
        if (t == null && serverData.length > 0) {
            // fallback nếu BE không trả total
            setTotalFromBE((prev) => Math.max(prev, serverData.length));
        }
    }, [serverData.length, swr.data]);

    // ── Exposed pagination ─────────────────────────────────────────
    const pagination = useMemo(() => ({
        current:  page,
        pageSize,
        total:    totalFromBE,
    }), [page, pageSize, totalFromBE]);

    const setPagination = useCallback((updater) => {
        const prev = { current: page, pageSize, total: totalFromBE };
        const next = typeof updater === 'function' ? updater(prev) : updater;

        const newPage     = next.current  ?? page;
        const newPageSize = next.pageSize ?? pageSize;

        if (newPageSize !== pageSize) {
            setPageSize(newPageSize);
            setPage(1);
        } else if (newPage !== page) {
            setPage(newPage);
        }
    }, [page, pageSize, totalFromBE]);

    // ── fetchPaged: called on form submit ──────────────────────────
    const fetchPaged = useCallback(async (p = 1, ps = pageSize) => {
        const values  = form.getFieldsValue();
        const payload = buildFilter(values);

        setPage(p);
        if (ps !== pageSize) setPageSize(ps);
        setFilterPayload(payload);
    }, [form, pageSize]);

    // ── fetchAll: compat (now = reset to page 1 + force) ──────────
    const fetchAll = useCallback(async () => {
        const values  = form.getFieldsValue();
        const payload = buildFilter(values);
        setPage(1);
        setFilterPayload(payload);

        await globalMutate(
            (key) => Array.isArray(key) && key[0] === 'usageSessions:v2',
            undefined,
            { revalidate: true },
        );
    }, [form, globalMutate]);

    const refresh = useCallback(async () => swr.mutate(), [swr]);

    // ── Initial auto-load ──────────────────────────────────────────
    useEffect(() => {
        const values  = form.getFieldsValue();
        const payload = buildFilter(values);
        setFilterPayload(payload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Error logging ──────────────────────────────────────────────
    useEffect(() => {
        if (!swr.error) return;
        console.error('[useUsageSessionData]', swr.error);
    }, [swr.error]);

    return {
        serverData,
        fullData,
        loading,
        pagination,
        setPagination,
        sortMode,
        setSortMode,
        tableFilters,
        setTableFilters,
        groupBy,
        setGroupBy,
        needFullData: false, // compat: không còn needFullData
        fetchPaged,
        fetchAll,
        refresh,
        mutate: refresh,
    };
}
