// features/tripSessionReport/hooks/useTripSessionData.js
//
// ✅ REFACTORED: FE pagination over ALL data (single large-limit fetch)
//    - 1 request với limit=9_999_999 → BE trả tất cả records
//    - Store trong memory, FE tự phân trang / sort
//    - Cache 5 phút theo filter key (module-level, trong useBulkTripFetch)
//    - "Làm mới" → force=true → bypass cache, fetch lại từ BE

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_PAGE_SIZE } from '../constants';
import { useBulkTripFetch } from './useBulkTripFetch';
import { applySortTrip } from '../utils';

// ── Helpers ───────────────────────────────────────────────────────
function normalizeTripFilter({ values, plateToImeis }) {
    const timeRange = values?.timeRange;
    const startTime = timeRange?.[0]
        ? (timeRange[0].toISOString?.() || String(timeRange[0]))
        : undefined;
    const endTime = timeRange?.[1]
        ? (timeRange[1].toISOString?.() || String(timeRange[1]))
        : undefined;

    const plate = values?.license_plate?.trim?.();

    return {
        tripCode:      values?.tripCode?.trim?.() || undefined,
        soh:           values?.soh || undefined,
        startTime,
        endTime,
        license_plate: plate || undefined,
    };
}

const cleanFloat = (value, digits = 3) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return value;
    const f = 10 ** digits;
    return Math.round((n + Number.EPSILON) * f) / f;
};

const cleanTripRow = (r) => ({
    ...r,
    distanceKm:   cleanFloat(r?.distanceKm, 3),
    mileageToday: cleanFloat(r?.mileageToday, 3),
    distance:     cleanFloat(r?.distance, 3),
    consumedKw:   cleanFloat(r?.consumedKw, 3),
    consumedKwh:  cleanFloat(r?.consumedKwh, 3),
    socEnd:       cleanFloat(r?.socEnd, 2),
    soh:          cleanFloat(r?.soh, 2),
    endLat:       cleanFloat(r?.endLat, 6),
    endLng:       cleanFloat(r?.endLng, 6),
    startLat:     cleanFloat(r?.startLat, 6),
    startLng:     cleanFloat(r?.startLng, 6),
});

// ── Main hook ─────────────────────────────────────────────────────
export function useTripSessionData({
    form,
    getTripSessions,
    isEn,
    t,
    imeiToPlate,
    plateToImeis,
    loadingDeviceMap,
    attachLicensePlate,
}) {
    // ── FE pagination state ───────────────────────────────────────
    const [page,     setPage]     = useState(1);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

    // ── FE sort (áp dụng trên toàn bộ allData) ───────────────────
    const [sortMode, setSortMode] = useState('none');

    // ── Current filter (lưu lại để forceRefresh dùng) ────────────
    const [filterPayload, setFilterPayload] = useState(null);

    // ── Bulk fetch (parallel chunks + cache) ─────────────────────
    const { allData: rawAll, loading, progress, fetchAll, refresh, cancel } = useBulkTripFetch({
        getTripSessions,
        chunkSize:     2000,
        maxConcurrent: 10,
    });

    // ── Clean numeric fields ──────────────────────────────────────
    const cleanedAll = useMemo(() => rawAll.map(cleanTripRow), [rawAll]);

    // ── Attach license plate (Map lookup — O(n), fast even for 94k) ─
    const allData = useMemo(() => {
        try {
            if (!attachLicensePlate || !imeiToPlate || imeiToPlate.size === 0) return cleanedAll;
            return attachLicensePlate(cleanedAll, imeiToPlate);
        } catch (e) {
            console.error('[useTripSessionData] attachLicensePlate error:', e);
            return cleanedAll;
        }
    }, [cleanedAll, attachLicensePlate, imeiToPlate]);

    // ── FE sort (trên toàn bộ allData) ───────────────────────────
    const sortedData = useMemo(() => applySortTrip(allData, sortMode), [allData, sortMode]);

    // ── FE pagination slice ───────────────────────────────────────
    // serverData = chỉ records của trang hiện tại (20/50/100 rows)
    const serverData = useMemo(() => {
        const start = (page - 1) * pageSize;
        return sortedData.slice(start, start + pageSize);
    }, [sortedData, page, pageSize]);

    // ── Pagination object (compatible với page.jsx API) ───────────
    const pagination = useMemo(() => ({
        current:  page,
        pageSize,
        total:    allData.length,   // FE total = toàn bộ allData
    }), [page, pageSize, allData.length]);

    // ── setPagination (called from page.jsx handleTableChange) ────
    const setPagination = useCallback((updater) => {
        const prev = { current: page, pageSize, total: allData.length };
        const next = typeof updater === 'function' ? updater(prev) : updater;

        const newPage     = next.current  ?? page;
        const newPageSize = next.pageSize ?? pageSize;

        if (newPageSize !== pageSize) {
            setPageSize(newPageSize);
            setPage(1);
        } else if (newPage !== page) {
            setPage(newPage);
        }
    }, [page, pageSize, allData.length]);

    // ── fetchBase (gọi khi submit form "Tìm kiếm") ───────────────
    const fetchBase = useCallback(async ({ resetPage } = {}, { force = false } = {}) => {
        const values  = form.getFieldsValue();
        const payload = normalizeTripFilter({ values, plateToImeis });

        setFilterPayload(payload);
        if (resetPage) setPage(1);

        await fetchAll(payload, { force });
    }, [form, plateToImeis, fetchAll]);

    // ── forceRefresh (bypass cache, dùng filter hiện tại) ────────
    // Gọi khi user bấm "Làm mới" để đảm bảo cache bị xoá
    const forceRefresh = useCallback(async () => {
        const values  = form.getFieldsValue();
        const payload = normalizeTripFilter({ values, plateToImeis });
        setFilterPayload(payload);
        setPage(1);
        await refresh(payload);
    }, [form, plateToImeis, refresh]);

    // ── Initial auto-load on mount ────────────────────────────────
    useEffect(() => {
        const values  = form.getFieldsValue();
        const payload = normalizeTripFilter({ values, plateToImeis });
        setFilterPayload(payload);
        fetchAll(payload); // sẽ serve từ cache nếu có
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return {
        serverData,      // current page slice (20–100 rows cho table)
        allData,         // ALL records (cho stats tổng + export Excel)
        loading,
        progress,        // { loaded, total, percent } — cho progress bar
        pagination,      // { current, pageSize, total } — total = allData.length
        setPagination,   // gọi khi chuyển trang (không re-fetch, chỉ slice)
        sortMode,
        setSortMode,
        fetchBase,       // gọi khi submit form search
        forceRefresh,    // gọi khi "Làm mới" (bypass cache)
        cancel,
        mutate: () => {},  // no-op for backward compat
    };
}
