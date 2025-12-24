// features/lastCruise/hooks/useLastCruiseData.js
import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { API_SAFE_LIMIT } from '../constants';
import { attachPlateToLastCruise, applyClientFilterSort } from '../utils';
import { useAuthStore } from '../../../stores/authStore';
import { stableStringify } from '../../_shared/swrKey';

// helpers
const normStr = (v) => (typeof v === 'string' ? v.trim() : '');
const normalizePlate = (s) =>
    (s || '').toString().trim().toUpperCase().replace(/\s+/g, '').replace(/[._]/g, '-').replace(/--+/g, '-');

const getRowDev = (row) => normStr(String(row?.dev ?? ''));

function makeKey(userId, params) {
    return params ? ['lastCruiseList', userId || 'guest', stableStringify(params)] : null;
}

export function useLastCruiseData({
    form,
    getLastCruiseList,
    imeiToPlate,
    plateToImeis,
    isEn,
    t,
    // loadingDeviceMap: giữ signature nếu nơi khác truyền vào, nhưng không dùng để block nữa
    loadingDeviceMap,
}) {
    const userId = useAuthStore((s) => s.user?._id) || 'guest';

    const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
    const [filterValues, _setFilterValues] = useState({});
    const [sortMode, _setSortMode] = useState('none');

    // params chỉ để gọi API load list (vì BE không filter)
    const [queryParams, setQueryParams] = useState({ page: 1, limit: API_SAFE_LIMIT });

    const fetcher = useCallback(
        async ([, , paramsJson]) => {
            const params = JSON.parse(paramsJson);
            return getLastCruiseList(params);
        },
        [getLastCruiseList],
    );

    // ✅ không block theo loadingDeviceMap nữa
    const swr = useSWR(makeKey(userId, queryParams), fetcher, {
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        revalidateIfStale: false,
        keepPreviousData: true,
        dedupingInterval: 5 * 60 * 1000,
        shouldRetryOnError: false,
    });

    // ✅ loading chỉ theo network data
    const loading = swr.isLoading || swr.isValidating;

    const apiList = useMemo(() => swr.data?.data || swr.data || [], [swr.data]);

    // ✅ attach plate lazy: map chưa sẵn thì trả list nguyên
    const rawData = useMemo(() => {
        try {
            if (!imeiToPlate || !(imeiToPlate instanceof Map) || imeiToPlate.size === 0) return apiList;
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

    // ✅ FE filter theo dev/plate + các field khác
    const processedData = useMemo(() => {
        const base = applyClientFilterSort({ rawData, filterValues, sortMode }) || [];

        const devInput = normStr(filterValues?.dev || '');
        const plateInput = normalizePlate(filterValues?.license_plate || '');

        if (devInput) return base.filter((row) => getRowDev(row).includes(devInput));

        if (plateInput) {
            const mapped = plateToImeis?.get?.(plateInput) || [];
            if (mapped.length > 0) {
                const set = new Set(mapped.map((x) => normStr(String(x))));
                return base.filter((row) => set.has(getRowDev(row)));
            }
            return base.filter((row) => normalizePlate(row?.license_plate || '').includes(plateInput));
        }

        return base;
    }, [rawData, filterValues, sortMode, plateToImeis]);

    const totalRecords = processedData.length;

    const pagedData = useMemo(() => {
        const { current, pageSize } = pagination;
        const start = (current - 1) * pageSize;
        return processedData.slice(start, start + pageSize);
    }, [processedData, pagination]);

    const tableData = useMemo(() => {
        return pagedData.map((row, idx) => ({
            ...row,
            __rowNo: (pagination.current - 1) * pagination.pageSize + idx + 1,
        }));
    }, [pagedData, pagination.current, pagination.pageSize]);

    const onSearch = useCallback(() => {
        const values = form.getFieldsValue();
        setFilterValues(values);
    }, [form, setFilterValues]);

    const onReset = useCallback(() => {
        form.resetFields();
        setFilterValues({});
        setSortMode('none');
        setPagination((p) => ({ ...p, current: 1 }));

        // ✅ gọi lại API
        swr.mutate(undefined, { revalidate: true });
    }, [form, setFilterValues, setSortMode, swr]);

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
        onSearch,
        onReset,
        handleTableChange,
        mutate: swr.mutate,
    };
}
