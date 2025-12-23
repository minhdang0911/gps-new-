import { useEffect, useMemo, useState, useCallback } from 'react';
import useSWR from 'swr';
import { API_SAFE_LIMIT } from '../constants';
import { buildParams } from '../utils';

// stable stringify để key ổn định
function stableStringify(obj) {
    if (!obj) return '';
    const allKeys = [];
    JSON.stringify(obj, (key, value) => {
        allKeys.push(key);
        return value;
    });
    allKeys.sort();
    return JSON.stringify(obj, allKeys);
}

function makeKey(prefix, params) {
    return params ? [prefix, stableStringify(params)] : null;
}

export function useUsageSessionData({ form, getUsageSessions, isEn, t }) {
    const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

    const [sortMode, setSortMode] = useState('none');
    const [tableFilters, setTableFilters] = useState({ vehicleId: null, batteryId: null });
    const [groupBy, setGroupBy] = useState('none');

    const needFullData = useMemo(() => {
        const hasTableFilter = tableFilters.vehicleId?.length || tableFilters.batteryId?.length;
        return sortMode !== 'none' || hasTableFilter || groupBy !== 'none';
    }, [sortMode, tableFilters, groupBy]);

    // params quyết định SWR fetch cái gì
    const [pagedParams, setPagedParams] = useState(null);
    const [allParams, setAllParams] = useState(null);

    const fetcher = useCallback(
        async (key) => {
            if (!key) return null;
            if (Array.isArray(key)) {
                const [, paramsJson] = key;
                const params = paramsJson ? JSON.parse(paramsJson) : {};
                return getUsageSessions(params);
            }
            return null;
        },
        [getUsageSessions],
    );

    // ✅ SWR opt cho cache “đúng nghĩa”
    const swrOpt = useMemo(
        () => ({
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
            revalidateIfStale: false,
            keepPreviousData: true,
            dedupingInterval: 5 * 60 * 1000, // 5 phút: cùng key thì không gọi lại
            shouldRetryOnError: false,
        }),
        [],
    );

    const pagedKey = useMemo(() => {
        if (needFullData) return null;
        return makeKey('usageSessions:paged', pagedParams);
    }, [needFullData, pagedParams]);

    const allKey = useMemo(() => {
        if (!needFullData) return null;
        return makeKey('usageSessions:all', allParams);
    }, [needFullData, allParams]);

    const swrPaged = useSWR(pagedKey, fetcher, swrOpt);
    const swrAll = useSWR(allKey, fetcher, swrOpt);

    const loading = needFullData
        ? swrAll.isLoading || swrAll.isValidating
        : swrPaged.isLoading || swrPaged.isValidating;

    const serverData = useMemo(() => (swrPaged.data?.data ? swrPaged.data.data : []), [swrPaged.data]);
    const fullData = useMemo(() => (swrAll.data?.data ? swrAll.data.data : []), [swrAll.data]);

    // ✅ Initial load: chỉ set params, SWR tự fetch + cache
    useEffect(() => {
        const values = form.getFieldsValue();
        const params = buildParams(values, 1, pagination.pageSize);
        setPagedParams(params);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ✅ Khi needFullData bật: set allParams để SWR fetch (có cache thì dùng)
    useEffect(() => {
        if (!needFullData) return;

        const values = form.getFieldsValue();
        const params = buildParams(values, 1, API_SAFE_LIMIT);

        setPagination((p) => ({ ...p, current: 1 }));
        setAllParams(params);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [needFullData]);

    // ✅ Update total
    useEffect(() => {
        if (!needFullData) {
            const list = serverData || [];
            const safeTotal = Math.max(swrPaged.data?.total || 0, list.length);
            setPagination((p) => ({ ...p, total: safeTotal }));
            return;
        }

        const list = fullData || [];
        const safeTotal = Math.max(swrAll.data?.total || 0, list.length);
        setPagination((p) => ({ ...p, total: safeTotal }));
    }, [needFullData, serverData, fullData, swrPaged.data, swrAll.data]);

    // ✅ API gọi theo page: chỉ đổi params (cache theo key)
    const fetchPaged = useCallback(
        async (page = 1, pageSize = pagination.pageSize || 20) => {
            const values = form.getFieldsValue();
            const params = buildParams(values, page, pageSize);

            setPagination((p) => ({ ...p, current: page, pageSize }));
            setPagedParams(params); // SWR tự fetch nếu key mới, nếu key cũ thì lấy cache
        },
        [form, pagination.pageSize],
    );

    const fetchAll = useCallback(async () => {
        const values = form.getFieldsValue();
        const params = buildParams(values, 1, API_SAFE_LIMIT);

        setPagination((p) => ({ ...p, current: 1 }));
        setAllParams(params);
    }, [form]);

    // ✅ Refetch chủ động (khi user bấm Search/Reset/Reload)
    const refresh = useCallback(async () => {
        if (needFullData) return swrAll.mutate();
        return swrPaged.mutate();
    }, [needFullData, swrAll, swrPaged]);

    // giữ API cũ
    const mutate = refresh;

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
        needFullData,

        fetchPaged,
        fetchAll,

        refresh,
        mutate,
    };
}
