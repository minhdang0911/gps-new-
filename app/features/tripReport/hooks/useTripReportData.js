import { useEffect, useMemo, useState, useCallback } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { message } from 'antd';
import { applyFilterSortTripReport } from '../utils';
import { useAuthStore } from '../../../stores/authStore'; // chỉnh path
import { stableStringify } from '../../_shared/swrKey'; // chỉnh path

function makeKey(userId, params) {
    return params ? ['tripReport', userId || 'guest', stableStringify(params)] : null;
}

export function useTripReportData({
    form,
    getTripReport,
    isEn,
    t,
    imeiToPlate,
    plateToImeis,
    loadingDeviceMap,
    attachLicensePlate,
}) {
    const userId = useAuthStore((s) => s.user?._id) || 'guest';
    const { mutate: globalMutate } = useSWRConfig();

    const [filterValues, setFilterValues] = useState({});
    const [sortMode, setSortMode] = useState('none');
    const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
    const [queryParams, setQueryParams] = useState(null);

    const fetcher = useCallback(
        async ([, , paramsJson]) => {
            const params = JSON.parse(paramsJson);
            return getTripReport(params);
        },
        [getTripReport],
    );

    const swrKey = useMemo(() => {
        if (loadingDeviceMap) return null;
        return makeKey(userId, queryParams);
    }, [loadingDeviceMap, queryParams, userId]);

    const swr = useSWR(swrKey, fetcher, {
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        revalidateIfStale: false,
        keepPreviousData: true,
        dedupingInterval: 5 * 60 * 1000,
        shouldRetryOnError: false,
    });

    const loading = loadingDeviceMap || swr.isLoading || swr.isValidating;

    const rawData = useMemo(() => {
        const res = swr.data;
        const list = res?.data || res?.items || [];
        try {
            return attachLicensePlate ? attachLicensePlate(list, imeiToPlate) : list;
        } catch {
            return list;
        }
    }, [swr.data, attachLicensePlate, imeiToPlate]);

    const totalFromBE = useMemo(() => Number(swr.data?.total) || 0, [swr.data]);

    const processedData = useMemo(() => {
        return applyFilterSortTripReport({ rawData, filterValues, sortMode });
    }, [rawData, filterValues, sortMode]);

    const tableData = useMemo(() => {
        return (processedData || []).map((row, idx) => ({
            ...row,
            __rowNo: (pagination.current - 1) * pagination.pageSize + idx + 1,
        }));
    }, [processedData, pagination.current, pagination.pageSize]);

    const buildParams = useCallback(
        (opts = {}) => {
            const page = opts.page ?? pagination.current;
            const limit = opts.limit ?? pagination.pageSize;
            const filters = opts.filters !== undefined ? opts.filters : filterValues;
            const mode = opts.sortMode !== undefined ? opts.sortMode : sortMode;

            // giữ logic __filters/__sortMode như bạn đang làm
            return {
                page,
                limit,
                __filters: filters || {},
                __sortMode: mode || 'none',
            };
        },
        [filterValues, sortMode, pagination.current, pagination.pageSize],
    );

    const fetchData = useCallback(
        async (opts = {}) => {
            try {
                const params = buildParams(opts);
                if (opts.page === 1) setPagination((p) => ({ ...p, current: 1 }));

                setQueryParams(params);

                // force call khi user bấm Search/Reset/Sort (nếu bạn muốn)
                const key = makeKey(userId, params);
                await globalMutate(key, fetcher, { revalidate: true });
            } catch (err) {
                console.error(err);
            }
        },
        [buildParams, globalMutate, fetcher, userId],
    );

    useEffect(() => {
        if (loadingDeviceMap) return;
        fetchData({ page: 1 });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadingDeviceMap, userId]);

    useEffect(() => {
        if (loadingDeviceMap) return;
        const safeTotal = Math.max(totalFromBE || 0, rawData.length);
        setPagination((p) => ({ ...p, total: safeTotal }));
    }, [loadingDeviceMap, totalFromBE, rawData.length]);

    useEffect(() => {
        if (!swr.error) return;
        console.error(swr.error);
    }, [swr.error, isEn]);

    return {
        loading,
        rawData,
        filterValues,
        setFilterValues,
        sortMode,
        setSortMode,
        pagination,
        setPagination,
        processedData,
        totalRecords: pagination.total,
        tableData,
        fetchData,
        mutate: swr.mutate,
    };
}
