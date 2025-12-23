// features/lastCruiseReport/hooks/useLastCruiseData.js
import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { message } from 'antd';
import { API_SAFE_LIMIT } from '../constants';
import { attachPlateToLastCruise, applyClientFilterSort } from '../utils';

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
    return params ? ['lastCruiseList', stableStringify(params)] : null;
}

export function useLastCruiseData({ form, getLastCruiseList, imeiToPlate, isEn, t }) {
    const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
    const [filterValues, _setFilterValues] = useState({});
    const [sortMode, _setSortMode] = useState('none'); // none | newest | oldest

    // 🔑 query params cho SWR (fetch full 1 lần)
    const [queryParams, setQueryParams] = useState({ page: 1, limit: API_SAFE_LIMIT });

    const fetcher = useCallback(
        async ([, paramsJson]) => {
            const params = JSON.parse(paramsJson);
            return getLastCruiseList(params);
        },
        [getLastCruiseList],
    );

    // ✅ cache-first: không auto revalidate khi focus/reconnect
    // ⚠️ không set revalidateOnMount:false để lần đầu có data
    const swr = useSWR(makeKey(queryParams), fetcher, {
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        revalidateIfStale: false,
        keepPreviousData: true,
        dedupingInterval: 5 * 60 * 1000,
        shouldRetryOnError: false,
    });

    const loading = swr.isLoading || swr.isValidating;

    // raw list từ API (chưa attach plate)
    const apiList = useMemo(() => {
        const res = swr.data;
        return res?.data || res || [];
    }, [swr.data]);

    // ✅ attach plate theo imeiToPlate (map đổi => chỉ recompute, KHÔNG gọi API lại)
    const rawData = useMemo(() => {
        try {
            return attachPlateToLastCruise(apiList, imeiToPlate);
        } catch (e) {
            console.error(e);
            return apiList;
        }
    }, [apiList, imeiToPlate]);

    // warning truncation
    useEffect(() => {
        if (!rawData?.length) return;
        if (rawData.length >= API_SAFE_LIMIT) {
            message.warning(
                isEn
                    ? `Data may be truncated (limit=${API_SAFE_LIMIT}). Consider increasing API_SAFE_LIMIT.`
                    : `Dữ liệu có thể bị cắt (limit=${API_SAFE_LIMIT}). Cân nhắc tăng API_SAFE_LIMIT.`,
            );
        }
    }, [rawData, isEn]);

    // error toast
    useEffect(() => {
        if (!swr.error) return;
        console.error('Lỗi lấy last cruise list: ', swr.error);
        message.error(isEn ? 'Failed to load last cruise list' : 'Không tải được danh sách vị trí cuối');
    }, [swr.error, isEn]);

    // ✅ FIX: reset page ngay tại nơi đổi filter/sort, KHÔNG dùng effect
    const setFilterValues = useCallback((next) => {
        setPagination((p) => ({ ...p, current: 1 }));
        _setFilterValues((prev) => (typeof next === 'function' ? next(prev) : next));
    }, []);

    const setSortMode = useCallback((next) => {
        setPagination((p) => ({ ...p, current: 1 }));
        _setSortMode(next);
    }, []);

    // FE filter/sort
    const processedData = useMemo(() => {
        return applyClientFilterSort({ rawData, filterValues, sortMode });
    }, [rawData, filterValues, sortMode]);

    const totalRecords = processedData.length;

    const pagedData = useMemo(() => {
        const { current, pageSize } = pagination;
        const start = (current - 1) * pageSize;
        const end = start + pageSize;
        return (processedData || []).slice(start, end);
    }, [processedData, pagination]);

    const tableData = useMemo(() => {
        return (pagedData || []).map((row, idx) => ({
            ...row,
            __rowNo: (pagination.current - 1) * pagination.pageSize + idx + 1,
        }));
    }, [pagedData, pagination.current, pagination.pageSize]);

    /**
     * ✅ fetchData: không gọi API trực tiếp
     * chỉ đổi queryParams (key đổi) => SWR fetch + cache
     * Hiện tại list này không phụ thuộc filter => thường không cần gọi fetchData.
     */
    const fetchData = useCallback((opts = {}) => {
        const next = { page: 1, limit: API_SAFE_LIMIT, ...opts };
        setPagination((p) => ({ ...p, current: 1 }));
        setQueryParams(next);
    }, []);

    const onSearch = () => {
        // dữ liệu đã fetch full; thường chỉ setFilterValues ở page là đủ
    };

    const onReset = () => {
        form.resetFields();
        setFilterValues({});
        setSortMode('none');
        setPagination((p) => ({ ...p, current: 1 }));
        // nếu muốn reload từ server: swr.mutate();
    };

    const handleTableChange = (pager) => {
        setPagination({ current: pager.current, pageSize: pager.pageSize });
    };

    return {
        rawData,
        // giữ để tương thích (thực tế rawData derive từ SWR)
        setRawData: () => {},

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

        fetchData,
        onSearch,
        onReset,
        handleTableChange,

        // ✅ reload khi user bấm nút
        mutate: swr.mutate,
    };
}
