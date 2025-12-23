// features/lastCruiseReport/hooks/useLastCruiseData.js
import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
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

export function useLastCruiseData({ form, getLastCruiseList, imeiToPlate, loadingDeviceMap, isEn, t }) {
    const { mutate: globalMutate } = useSWRConfig();

    const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
    const [filterValues, _setFilterValues] = useState({});
    const [sortMode, _setSortMode] = useState('none'); // none | newest | oldest

    // ✅ IMPORTANT: null để "không fetch" cho tới khi ta set params (đọc cache)
    const [queryParams, setQueryParams] = useState(null);

    const fetcher = useCallback(
        async ([, paramsJson]) => {
            const params = JSON.parse(paramsJson);
            return getLastCruiseList(params);
        },
        [getLastCruiseList],
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
        // ❌ không set revalidateOnMount:false (để cache miss => fetch được)
    });

    const loading = loadingDeviceMap || swr.isLoading || swr.isValidating;

    // raw list từ API (chưa attach plate)
    const apiList = useMemo(() => {
        const res = swr.data;
        // tuỳ BE trả shape nào
        return res?.data || res?.items || res || [];
    }, [swr.data]);

    // attach plate (map đổi chỉ recompute)
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
            // message.warning(
            //     isEn
            //         ? `Data may be truncated (limit=${API_SAFE_LIMIT}).`
            //         : `Dữ liệu có thể bị cắt (limit=${API_SAFE_LIMIT}).`,
            // );
        }
    }, [rawData, isEn]);

    // error toast
    useEffect(() => {
        if (!swr.error) return;
        console.error('Lỗi lấy last cruise list: ', swr.error);
        // message.error(
        //     t?.messages?.loadError ||
        //         (isEn ? 'Failed to load last cruise list' : 'Không tải được danh sách vị trí cuối'),
        // );
    }, [swr.error, isEn, t]);

    // ✅ set filter/sort: reset page ngay tại đây (không dùng effect)
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

    // paginate FE
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

    // ✅ helper build params (ở đây list fetch full 1 lần)
    const buildBaseParams = useCallback(() => {
        const values = form.getFieldsValue?.() || {};
        // Nếu BE cần filter theo query => map thật ở đây
        // Còn nếu filter FE-only thì để params fixed (page=1 limit=API_SAFE_LIMIT)
        return {
            page: 1,
            limit: API_SAFE_LIMIT,
            // gắn "signature" để key đổi khi user Search/Reset nếu muốn
            __form: values,
        };
    }, [form]);

    // ✅ initial: chỉ set queryParams để "đọc cache"
    // - cache hit: show luôn, không request
    // - cache miss (F5/lần đầu): SWR fetch 1 lần
    useEffect(() => {
        if (loadingDeviceMap) return;
        const params = buildBaseParams();
        setQueryParams(params);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadingDeviceMap]);

    /**
     * ✅ FORCE fetch (chỉ khi user bấm Search/Reset)
     */
    const forceFetch = useCallback(
        async (params) => {
            const key = makeKey(params);
            await globalMutate(key, fetcher, { revalidate: true });
        },
        [globalMutate, fetcher],
    );

    // ===== actions =====

    // Search: nếu filter FE-only -> chỉ cần setFilterValues ở page
    // nhưng nếu muốn "Search" luôn call API (theo yêu cầu), thì forceFetch.
    const onSearch = useCallback(async () => {
        const params = buildBaseParams();
        setPagination((p) => ({ ...p, current: 1 }));
        setQueryParams(params);
        await forceFetch(params);
    }, [buildBaseParams, forceFetch]);

    const onReset = useCallback(async () => {
        form.resetFields();
        setFilterValues({});
        setSortMode('none');
        setPagination((p) => ({ ...p, current: 1 }));

        const params = buildBaseParams();
        setQueryParams(params);
        await forceFetch(params);
    }, [form, setFilterValues, setSortMode, buildBaseParams, forceFetch]);

    const handleTableChange = useCallback((pager) => {
        setPagination({ current: pager.current, pageSize: pager.pageSize });
    }, []);

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
