// features/tripReport/hooks/useTripReportData.js
import { useEffect, useMemo, useState, useCallback } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { message } from 'antd';
import { applyFilterSortTripReport } from '../utils';

/**
 * build params để:
 * - BE có dùng thì map thật vào đây
 * - BE chưa dùng thì vẫn nhét vào để SWR key thay đổi theo filter/sort
 */
function buildTripReportParams(filterValues, sortMode) {
    return {
        __filters: filterValues || {},
        __sortMode: sortMode || 'none',
    };
}

function stableStringify(obj) {
    if (!obj) return '';
    const keys = [];
    JSON.stringify(obj, (k, v) => {
        keys.push(k);
        return v;
    });
    keys.sort();
    return JSON.stringify(obj, keys);
}

function makeKey(params) {
    return params ? ['tripReport', stableStringify(params)] : null;
}

export function useTripReportData({
    form,
    getTripReport,
    isEn,
    t,
    imeiToPlate,
    plateToImeis, // reserved
    loadingDeviceMap,
    attachLicensePlate,
}) {
    const { mutate: globalMutate } = useSWRConfig();

    // UI state
    const [filterValues, setFilterValues] = useState({});
    const [sortMode, setSortMode] = useState('none');

    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 10,
        total: 0,
    });

    // 🔑 params quyết định SWR fetch
    const [queryParams, setQueryParams] = useState(null);

    const fetcher = useCallback(
        async ([, paramsJson]) => {
            const params = JSON.parse(paramsJson);
            return getTripReport(params);
        },
        [getTripReport],
    );

    const swrKey = useMemo(() => {
        if (loadingDeviceMap) return null;
        return makeKey(queryParams);
    }, [loadingDeviceMap, queryParams]);

    // ✅ cache-first
    const swr = useSWR(swrKey, fetcher, {
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        revalidateIfStale: false,
        keepPreviousData: true,
        dedupingInterval: 5 * 60 * 1000,
        shouldRetryOnError: false,
        // ❌ đừng set revalidateOnMount:false
    });

    const loading = loadingDeviceMap || swr.isLoading || swr.isValidating;

    // ===== raw list =====
    const rawList = useMemo(() => {
        const res = swr.data;
        const list = res?.data || res?.items || res?.devices || [];
        try {
            return attachLicensePlate ? attachLicensePlate(list, imeiToPlate) : list;
        } catch (e) {
            console.error(e);
            return list;
        }
    }, [swr.data, attachLicensePlate, imeiToPlate]);

    const totalFromBE = useMemo(() => {
        const n = Number(swr.data?.total);
        return Number.isFinite(n) ? n : 0;
    }, [swr.data]);

    // FE filter/sort (nếu bạn vẫn muốn)
    const processedData = useMemo(() => {
        return applyFilterSortTripReport({ rawData: rawList, filterValues, sortMode });
    }, [rawList, filterValues, sortMode]);

    // tableData phân trang FE (bạn đang làm kiểu này)
    const tableData = useMemo(() => {
        const start = (pagination.current - 1) * pagination.pageSize;
        const end = start + pagination.pageSize;

        return (processedData || []).slice(start, end).map((row, idx) => ({
            ...row,
            __rowNo: start + idx + 1,
        }));
    }, [processedData, pagination.current, pagination.pageSize]);

    const totalRecords = pagination.total;

    // ===== buildParams =====
    const buildParams = useCallback(
        (opts = {}) => {
            const page = opts.page ?? pagination.current;
            const limit = opts.limit ?? pagination.pageSize;

            const filters = opts.filters !== undefined ? opts.filters : filterValues;
            const mode = opts.sortMode !== undefined ? opts.sortMode : sortMode;

            const extra = buildTripReportParams(filters, mode);

            // Nếu BE có param thật, map ở đây:
            // ví dụ:
            // return { page, limit, ...mapFilters(filters), sort: mode }

            return { page, limit, ...extra };
        },
        [pagination.current, pagination.pageSize, filterValues, sortMode],
    );

    // ✅ force fetch helper (chỉ gọi khi user bấm)
    const forceFetch = useCallback(
        async (params) => {
            const key = makeKey(params);
            await globalMutate(key, fetcher, { revalidate: true });
        },
        [globalMutate, fetcher],
    );

    /**
     * ✅ fetchData:
     * - default: chỉ setQueryParams (đọc cache nếu có, cache miss thì SWR tự fetch)
     * - force=true: ép gọi API (Search/Reset/Sort)
     */
    const fetchData = useCallback(
        async (opts = {}, { force = false } = {}) => {
            try {
                const params = buildParams(opts);

                // sync pagination UI
                if (opts.page !== undefined || opts.limit !== undefined) {
                    setPagination((p) => ({
                        ...p,
                        current: opts.page ?? p.current,
                        pageSize: opts.limit ?? p.pageSize,
                    }));
                } else if (opts.page === 1) {
                    setPagination((p) => ({ ...p, current: 1 }));
                }

                setQueryParams(params);

                if (force) {
                    await forceFetch(params);
                }
            } catch (err) {
                console.error('TripReport fetchData error:', err);
            }
        },
        [buildParams, forceFetch],
    );

    // ✅ initial load: chỉ set params để "đọc cache"
    useEffect(() => {
        if (loadingDeviceMap) return;

        const values = form.getFieldsValue();
        setFilterValues(values || {});
        const params = buildParams({ page: 1, filters: values || {}, sortMode });
        setQueryParams(params);

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadingDeviceMap]);

    // total sync (ưu tiên total BE, fallback length)
    useEffect(() => {
        if (loadingDeviceMap) return;
        const safeTotal = Math.max(totalFromBE || 0, processedData.length);
        setPagination((p) => ({ ...p, total: safeTotal }));
    }, [loadingDeviceMap, totalFromBE, processedData.length]);

    // error
    useEffect(() => {
        if (!swr.error) return;
        console.error('Lỗi lấy trip report: ', swr.error);
        // message.error(t?.messages?.loadError || (isEn ? 'Failed to load trip report' : 'Không tải được trip report'));
    }, [swr.error, isEn, t]);

    const mutate = useCallback(() => swr.mutate(), [swr]);

    return {
        loading,

        rawData: rawList,

        filterValues,
        setFilterValues,

        sortMode,
        setSortMode,

        pagination,
        setPagination,

        processedData,
        totalRecords,
        tableData,

        fetchData,
        mutate,
    };
}
