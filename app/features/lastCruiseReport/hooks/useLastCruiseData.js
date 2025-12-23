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

export function useLastCruiseData({ form, getLastCruiseList, imeiToPlate, plateToImeis, isEn, t, loadingDeviceMap }) {
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

    const swr = useSWR(loadingDeviceMap ? null : makeKey(userId, queryParams), fetcher, {
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        revalidateIfStale: false,
        keepPreviousData: true,
        dedupingInterval: 5 * 60 * 1000,
        shouldRetryOnError: false,
    });

    const loading = loadingDeviceMap || swr.isLoading || swr.isValidating;

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

    // ✅ FE filter theo dev/plate + các field khác
    const processedData = useMemo(() => {
        // base filter/sort (fwr, gpsStatus, sosStatus, timeRange...) theo util hiện có
        const base = applyClientFilterSort({ rawData, filterValues, sortMode }) || [];

        const devInput = normStr(filterValues?.dev || '');
        const plateInput = normalizePlate(filterValues?.license_plate || '');

        // 1) dev input => partial
        if (devInput) return base.filter((row) => getRowDev(row).includes(devInput));

        // 2) plate => map ra devs (exact)
        if (plateInput) {
            const mapped = plateToImeis?.get?.(plateInput) || [];
            if (mapped.length > 0) {
                const set = new Set(mapped.map((x) => normStr(String(x))));
                return base.filter((row) => set.has(getRowDev(row)));
            }

            // 3) fallback: filter theo license_plate text đã attach
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

    // ✅ onSearch: chỉ set filterValues từ form (không cần gọi API)
    const onSearch = useCallback(() => {
        const values = form.getFieldsValue();
        setFilterValues(values);
    }, [form, setFilterValues]);

    const onReset = useCallback(() => {
        form.resetFields();
        setFilterValues({});
        setSortMode('none');
        setPagination((p) => ({ ...p, current: 1 }));
        // nếu muốn reload list:
        // swr.mutate(undefined, { revalidate: true });
    }, [form, setFilterValues, setSortMode]);

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
        onSearch, // ✅ thêm
        onReset,
        handleTableChange,
        mutate: swr.mutate,
    };
}
