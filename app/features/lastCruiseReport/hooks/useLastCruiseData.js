import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { API_SAFE_LIMIT } from '../constants';
import { attachPlateToLastCruise, applyClientFilterSort } from '../utils';
import { useAuthStore } from '../../../stores/authStore';
import { stableStringify } from '../../_shared/swrKey';

function makeKey(userId, params) {
    return params ? ['lastCruiseList', userId || 'guest', stableStringify(params)] : null;
}

export function useLastCruiseData({ form, getLastCruiseList, imeiToPlate, isEn, t }) {
    const userId = useAuthStore((s) => s.user?._id) || 'guest';

    const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
    const [filterValues, _setFilterValues] = useState({});
    const [sortMode, _setSortMode] = useState('none');
    const [queryParams, setQueryParams] = useState({ page: 1, limit: API_SAFE_LIMIT });

    const fetcher = useCallback(
        async ([, , paramsJson]) => {
            const params = JSON.parse(paramsJson);
            return getLastCruiseList(params);
        },
        [getLastCruiseList],
    );

    const swr = useSWR(makeKey(userId, queryParams), fetcher, {
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        revalidateIfStale: false,
        keepPreviousData: true,
        dedupingInterval: 5 * 60 * 1000,
        shouldRetryOnError: false,
    });

    const loading = swr.isLoading || swr.isValidating;

    const apiList = useMemo(() => swr.data?.data || swr.data || [], [swr.data]);

    const rawData = useMemo(() => {
        try {
            return attachPlateToLastCruise(apiList, imeiToPlate);
        } catch (e) {
            console.error(e);
            return apiList;
        }
    }, [apiList, imeiToPlate]);

    useEffect(() => {
        if (!swr.error) return;
        console.error(swr.error);
    }, [swr.error]);

    const setFilterValues = useCallback((next) => {
        setPagination((p) => ({ ...p, current: 1 }));
        _setFilterValues((prev) => (typeof next === 'function' ? next(prev) : next));
    }, []);

    const setSortMode = useCallback((next) => {
        setPagination((p) => ({ ...p, current: 1 }));
        _setSortMode(next);
    }, []);

    const processedData = useMemo(() => {
        return applyClientFilterSort({ rawData, filterValues, sortMode });
    }, [rawData, filterValues, sortMode]);

    const totalRecords = processedData.length;

    const pagedData = useMemo(() => {
        const { current, pageSize } = pagination;
        const start = (current - 1) * pageSize;
        return (processedData || []).slice(start, start + pageSize);
    }, [processedData, pagination]);

    const tableData = useMemo(() => {
        return (pagedData || []).map((row, idx) => ({
            ...row,
            __rowNo: (pagination.current - 1) * pagination.pageSize + idx + 1,
        }));
    }, [pagedData, pagination.current, pagination.pageSize]);

    const onReset = () => {
        form.resetFields();
        setFilterValues({});
        setSortMode('none');
        setPagination((p) => ({ ...p, current: 1 }));
        swr.mutate(undefined, { revalidate: true });
    };

    const handleTableChange = (pager) => {
        setPagination({ current: pager.current, pageSize: pager.pageSize });
    };

    return {
        rawData,
        loading,
        pagination,
        setPagination,
        filterValues,
        setFilterValues,
        sortMode,
        setSortMode,
        processedData,
        totalRecords,
        tableData,
        onReset,
        handleTableChange,
        mutate: swr.mutate,
    };
}
