import { useEffect, useMemo, useState, useCallback } from 'react';
import useSWR from 'swr';
import { Form } from 'antd';
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

    // ✅ FIX: watch timeRange REACTIVE (đổi range là hook biết ngay)
    const watchedTimeRange = Form.useWatch('timeRange', form);

    const hasTimeRange = useMemo(() => {
        const v = watchedTimeRange;
        return Array.isArray(v) && v.length === 2 && !!v?.[0] && !!v?.[1];
    }, [watchedTimeRange]);

    const needFullData = useMemo(() => {
        const hasTableFilter = tableFilters.vehicleId?.length || tableFilters.batteryId?.length;
        return sortMode !== 'none' || hasTableFilter || groupBy !== 'none' || hasTimeRange;
    }, [sortMode, tableFilters, groupBy, hasTimeRange]);

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

    const swrOpt = useMemo(
        () => ({
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
            revalidateIfStale: false,
            keepPreviousData: true,
            dedupingInterval: 5 * 60 * 1000,
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

    // ✅ Initial load: set paged params
    useEffect(() => {
        const values = form.getFieldsValue();
        const params = buildParams(values, 1, pagination.pageSize);
        setPagedParams(params);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ✅ Khi needFullData bật: set allParams để SWR fetch
    useEffect(() => {
        if (!needFullData) return;

        const values = form.getFieldsValue();
        const params = buildParams(values, 1, API_SAFE_LIMIT);

        setPagination((p) => ({ ...p, current: 1 }));
        setAllParams(params);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [needFullData]);

    // ✅ Update total (an toàn)
    useEffect(() => {
        if (!needFullData) {
            const list = serverData || [];
            const safeTotal = Math.max(Number(swrPaged.data?.total || 0), list.length);
            setPagination((p) => ({ ...p, total: safeTotal }));
            return;
        }

        const list = fullData || [];
        const safeTotal = Math.max(Number(swrAll.data?.total || 0), list.length);
        setPagination((p) => ({ ...p, total: safeTotal }));
    }, [needFullData, serverData, fullData, swrPaged.data, swrAll.data]);

    const fetchPaged = useCallback(
        async (page = 1, pageSize = pagination.pageSize || 20) => {
            const values = form.getFieldsValue();
            const params = buildParams(values, page, pageSize);

            setPagination((p) => ({ ...p, current: page, pageSize }));
            setPagedParams(params);
        },
        [form, pagination.pageSize],
    );

    const fetchAll = useCallback(async () => {
        const values = form.getFieldsValue();
        const params = buildParams(values, 1, API_SAFE_LIMIT);

        setPagination((p) => ({ ...p, current: 1 }));
        setAllParams(params);
    }, [form]);

    const refresh = useCallback(async () => {
        if (needFullData) return swrAll.mutate();
        return swrPaged.mutate();
    }, [needFullData, swrAll, swrPaged]);

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
        mutate: refresh,
    };
}
