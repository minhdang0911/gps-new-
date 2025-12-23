// features/tripReport/hooks/useTripReportData.js
import { useEffect, useMemo, useState, useCallback } from 'react';
import useSWR from 'swr';
import { message } from 'antd';
import { applyFilterSortTripReport } from '../utils';

/**
 * Nếu BE có hỗ trợ filter/sort qua query params
 * thì build ở đây rồi truyền vào getTripReport(...)
 * (tuỳ dự án, bạn map key cho đúng)
 */
function buildTripReportParams(filterValues, sortMode) {
    const params = {};

    // Ví dụ (tuỳ bạn thay key):
    // if (filterValues?.imei) params.imei = filterValues.imei;
    // if (filterValues?.dateFrom) params.dateFrom = filterValues.dateFrom;
    // if (filterValues?.dateTo) params.dateTo = filterValues.dateTo;

    // sortMode ví dụ: 'none' | 'date_desc' | 'date_asc'...
    // if (sortMode && sortMode !== 'none') params.sort = sortMode;

    return params;
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

    // ✅ cache-first (không tự gọi lại khi focus/reconnect)
    // ⚠️ không set revalidateOnMount:false để tránh “0 request / bảng trống”
    const swr = useSWR(loadingDeviceMap ? null : makeKey(queryParams), fetcher, {
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        revalidateIfStale: false,
        keepPreviousData: true,
        dedupingInterval: 5 * 60 * 1000,
        shouldRetryOnError: false,
    });

    const loading = loadingDeviceMap || swr.isLoading || swr.isValidating;

    // raw list từ BE
    const rawData = useMemo(() => {
        const res = swr.data;
        const list = res?.data || res?.items || [];
        // enrich biển số (map đổi => chỉ recompute)
        try {
            return attachLicensePlate ? attachLicensePlate(list, imeiToPlate) : list;
        } catch {
            return list;
        }
    }, [swr.data, attachLicensePlate, imeiToPlate]);

    // total từ BE
    const totalFromBE = useMemo(() => {
        const total = swr.data?.total;
        const n = Number(total);
        return Number.isFinite(n) ? n : 0;
    }, [swr.data]);

    /**
     * Nếu BE đã filter/sort đầy đủ -> processedData = rawData
     * Nếu BE chưa hỗ trợ, có thể apply trong 1 trang (tạm)
     */
    const processedData = useMemo(() => {
        // Option A: return rawData;
        return applyFilterSortTripReport({ rawData, filterValues, sortMode });
    }, [rawData, filterValues, sortMode]);

    // tableData + rowNo
    const tableData = useMemo(() => {
        return (processedData || []).map((row, idx) => ({
            ...row,
            __rowNo: (pagination.current - 1) * pagination.pageSize + idx + 1,
        }));
    }, [processedData, pagination.current, pagination.pageSize]);

    const totalRecords = pagination.total;

    // ✅ 1 hàm build params chuẩn (dùng chung)
    const buildParams = useCallback(
        (opts = {}) => {
            const page = opts.page ?? pagination.current;
            const limit = opts.limit ?? pagination.pageSize;

            // nếu bạn muốn lấy filterValues từ Form thay vì state:
            // const values = form.getFieldsValue();
            // còn hiện tại filterValues đang là state => giữ nguyên

            const extraParams = buildTripReportParams(filterValues, sortMode);

            return {
                page,
                limit,
                ...extraParams,
            };
        },
        [filterValues, sortMode, pagination.current, pagination.pageSize],
    );

    /**
     * ✅ fetchData bây giờ KHÔNG gọi API trực tiếp
     * nó chỉ set queryParams => SWR fetch/cached theo key
     */
    const fetchData = useCallback(
        (opts = {}) => {
            try {
                const params = buildParams(opts);

                // nếu reset page
                if (opts.page === 1) {
                    setPagination((p) => ({ ...p, current: 1 }));
                }

                setQueryParams(params);
            } catch (err) {
                console.error('Lỗi chuẩn bị params trip report: ', err);
                message.error(isEn ? 'Failed to load trip report' : 'Không tải được trip report');
            }
        },
        [buildParams, isEn],
    );

    // Load lần đầu (khi map device sẵn sàng)
    useEffect(() => {
        if (loadingDeviceMap) return;
        fetchData({ page: 1 });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadingDeviceMap]);

    // Khi filter/sort đổi -> reset page 1 và refetch (đúng logic cũ)
    useEffect(() => {
        if (loadingDeviceMap) return;
        setPagination((p) => ({ ...p, current: 1 }));
        fetchData({ page: 1 });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterValues, sortMode]);

    // Sync pagination.total từ BE (và fallback length)
    useEffect(() => {
        if (loadingDeviceMap) return;
        const safeTotal = Math.max(totalFromBE || 0, rawData.length);
        setPagination((p) => ({ ...p, total: safeTotal }));
    }, [loadingDeviceMap, totalFromBE, rawData.length]);

    // error toast
    useEffect(() => {
        if (!swr.error) return;
        console.error('Lỗi lấy trip report: ', swr.error);
        message.error(isEn ? 'Failed to load trip report' : 'Không tải được trip report');
    }, [swr.error, isEn]);

    // onChange cho antd Table
    const onTableChange = useCallback(
        (p) => {
            setPagination((prev) => ({ ...prev, current: p.current, pageSize: p.pageSize }));
            fetchData({ page: p.current, limit: p.pageSize });
        },
        [fetchData],
    );

    const mutate = useCallback(() => swr.mutate(), [swr]);

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
        totalRecords,
        tableData,

        fetchData,
        onTableChange,

        mutate, // ✅ reload
    };
}
