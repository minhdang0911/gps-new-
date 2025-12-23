// features/usageSessionReport/hooks/useUsageSessionData.js
import { useEffect, useMemo, useState, useCallback } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { message } from 'antd';
import { API_SAFE_LIMIT } from '../constants';
import { buildParams } from '../utils';

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
    const { mutate: globalMutate } = useSWRConfig();

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
        async ([, paramsJson]) => {
            const params = JSON.parse(paramsJson);
            return getUsageSessions(params);
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

    const toastLoadError = useCallback(() => {
        // message.error(
        //     t.messages?.loadError ||
        //         (!isEn ? 'Không tải được danh sách phiên sử dụng' : 'Failed to load usage sessions'),
        // );
    }, [isEn, t]);

    const forceFetch = useCallback(
        async (prefix, params) => {
            const key = makeKey(prefix, params);
            await globalMutate(key, fetcher, { revalidate: true });
        },
        [globalMutate, fetcher],
    );

    // ✅ giữ API cũ cho page gọi, nhưng đảm bảo gọi API chắc chắn
    const fetchPaged = useCallback(
        async (page = 1, pageSize = pagination.pageSize || 20) => {
            try {
                const values = form.getFieldsValue();
                const params = buildParams(values, page, pageSize);

                setPagination((p) => ({ ...p, current: page, pageSize }));
                setPagedParams(params);

                // ✅ Force call even if params identical
                await forceFetch('usageSessions:paged', params);
            } catch (err) {
                console.error(err);
                toastLoadError();
            }
        },
        [form, pagination.pageSize, buildParams, forceFetch, toastLoadError],
    );

    const fetchAll = useCallback(async () => {
        try {
            const values = form.getFieldsValue();
            const params = buildParams(values, 1, API_SAFE_LIMIT);

            setPagination((p) => ({ ...p, current: 1 }));
            setAllParams(params);

            // ✅ Force call even if params identical
            await forceFetch('usageSessions:all', params);
        } catch (err) {
            console.error(err);
            toastLoadError();
        }
    }, [form, buildParams, forceFetch, toastLoadError]);

    // initial load (paged) — set params + force fetch
    useEffect(() => {
        const values = form.getFieldsValue();
        const params = buildParams(values, 1, pagination.pageSize);
        setPagedParams(params);
        forceFetch('usageSessions:paged', params);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // khi needFullData bật -> chuẩn bị allParams + force fetch
    useEffect(() => {
        if (!needFullData) return;

        const values = form.getFieldsValue();
        const params = buildParams(values, 1, API_SAFE_LIMIT);

        setPagination((p) => ({ ...p, current: 1 }));
        setAllParams(params);
        forceFetch('usageSessions:all', params);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [needFullData]);

    // update total + warning truncation
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

        if (list.length >= API_SAFE_LIMIT) {
            // message.warning(
            //     isEn
            //         ? `Data may be truncated (limit=${API_SAFE_LIMIT}).`
            //         : `Dữ liệu có thể bị cắt (limit=${API_SAFE_LIMIT}).`,
            // );
        }
    }, [needFullData, serverData, fullData, swrPaged.data, swrAll.data, isEn]);

    // handle error
    useEffect(() => {
        const err = needFullData ? swrAll.error : swrPaged.error;
        if (!err) return;

        console.error(err);
        toastLoadError();
    }, [needFullData, swrAll.error, swrPaged.error, toastLoadError]);

    const mutate = useCallback(() => {
        if (needFullData) return swrAll.mutate();
        return swrPaged.mutate();
    }, [needFullData, swrAll, swrPaged]);

    return {
        serverData,
        fullData,

        loading,
        pagination,
        sortMode,
        setSortMode,
        tableFilters,
        setTableFilters,
        groupBy,
        setGroupBy,
        needFullData,

        fetchPaged,
        fetchAll,
        setPagination,

        mutate,
    };
}
