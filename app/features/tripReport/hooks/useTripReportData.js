// useTripReportData.js
import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { message } from 'antd';
import { useAuthStore } from '../../../stores/authStore';
import { stableStringify } from '../../_shared/swrKey';
import { applyFilterSortTripReport } from '../utils';

// ========= helpers =========
const normStr = (v) => (typeof v === 'string' ? v.trim() : '');
const normalizePlate = (s) =>
    (s || '').toString().trim().toUpperCase().replace(/\s+/g, '').replace(/[._]/g, '-').replace(/--+/g, '-');

const getRowImei = (row) => normStr(String(row?.imei ?? row?.IMEI ?? row?.deviceImei ?? row?.device?.imei ?? ''));

// ✅ build payload gửi BE (bỏ imei/license_plate)
function normalizeTripReportPayload({ filters = {}, page = 1, limit = 10 }) {
    const timeRange = filters?.timeRange;
    // TripReportPage dùng RangePicker format YYYY-MM-DD (không showTime)
    // vẫn giữ an toàn: dayjs object hoặc string đều ok
    const startDate = timeRange?.[0]?.toISOString?.() || (timeRange?.[0] ? String(timeRange[0]) : undefined);
    const endDate = timeRange?.[1]?.toISOString?.() || (timeRange?.[1] ? String(timeRange[1]) : undefined);

    return {
        page,
        limit,

        // ✅ chỉ gửi những field BE support (tuỳ API bạn, giữ đúng key)
        motorcycleId: filters?.motorcycleId ? normStr(filters.motorcycleId) : undefined,
        connectionStatus: filters?.connectionStatus || undefined,
        movementStatus: filters?.movementStatus || undefined,
        lockStatus: filters?.lockStatus || undefined,

        startDate, // hoặc startTime tuỳ BE
        endDate, // hoặc endTime tuỳ BE

        // ❌ không gửi:
        // imei: ...
        // license_plate: ...
    };
}

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

    // ✅ params gửi BE
    const [queryParams, setQueryParams] = useState(null);

    const fetcher = useCallback(
        async ([, , paramsJson]) => {
            const params = JSON.parse(paramsJson);
            return getTripReport(params);
        },
        [getTripReport],
    );
    const swrKey = useMemo(() => {
        return makeKey(userId, queryParams);
    }, [queryParams, userId]);

    const swr = useSWR(swrKey, fetcher, {
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        revalidateIfStale: false,
        keepPreviousData: true,
        dedupingInterval: 5 * 60 * 1000,
        shouldRetryOnError: false,
    });

    const loading = swr.isLoading || swr.isValidating;

    // ===== raw data + attach plate =====
    const rawData = useMemo(() => {
        const res = swr.data;
        const list = res?.data || res?.items || [];
        try {
            if (!attachLicensePlate) return list;
            if (!imeiToPlate || imeiToPlate.size === 0) return list; // ✅ map chưa sẵn thì return luôn
            return attachLicensePlate(list, imeiToPlate);
        } catch {
            return list;
        }
    }, [swr.data, attachLicensePlate, imeiToPlate]);

    // ===== derived FE filters: license_plate -> imeis =====
    const derivedFilters = useMemo(() => {
        const values = filterValues || {};
        const plateInputRaw = normStr(values?.license_plate || '');
        const plateKey = plateInputRaw ? normalizePlate(plateInputRaw) : '';

        const imeiInput = normStr(values?.imei || '');

        // plateToImeis là Map
        const mappedImeis = plateKey ? plateToImeis?.get?.(plateKey) || [] : [];

        return {
            ...values,
            __plateKey: plateKey,
            __mappedImeis: mappedImeis,
            __imeiInput: imeiInput,
        };
    }, [filterValues, plateToImeis]);

    // ===== apply filter + sort (FE) =====
    const processedData = useMemo(() => {
        // 1) lọc các field BE-like trong FE (motorcycleId/status/timeRange...) bằng util có sẵn
        const base = applyFilterSortTripReport({
            rawData,
            filterValues: derivedFilters,
            sortMode,
        });

        const plateKey = derivedFilters.__plateKey;
        const mappedImeis = derivedFilters.__mappedImeis || [];
        const imeiInput = derivedFilters.__imeiInput;

        // 2) ưu tiên IMEI -> plate map -> fallback plate text
        if (imeiInput) {
            return (base || []).filter((row) => getRowImei(row).includes(imeiInput));
        }

        if (plateKey && mappedImeis.length > 0) {
            const set = new Set(mappedImeis.map((x) => normStr(String(x))));
            return (base || []).filter((row) => set.has(getRowImei(row)));
        }

        if (plateKey && mappedImeis.length === 0) {
            return (base || []).filter((row) => normalizePlate(row?.license_plate || '').includes(plateKey));
        }

        return base || [];
    }, [rawData, derivedFilters, sortMode]);

    // ===== pagination total + clamp current =====
    useEffect(() => {
        setPagination((p) => ({ ...p, total: processedData.length }));
    }, [processedData.length]);

    useEffect(() => {
        const total = processedData.length;
        const pageSize = pagination.pageSize || 10;
        const maxPage = Math.max(1, Math.ceil(total / pageSize));
        if (pagination.current > maxPage) setPagination((p) => ({ ...p, current: 1 }));
    }, [processedData.length, pagination.pageSize, pagination.current]);

    // ===== tableData (paged) =====
    const tableData = useMemo(() => {
        const { current, pageSize } = pagination;
        const start = (current - 1) * pageSize;
        const end = start + pageSize;
        const sliced = (processedData || []).slice(start, end);
        return sliced.map((row, idx) => ({
            ...row,
            __rowNo: (current - 1) * pageSize + idx + 1,
        }));
    }, [processedData, pagination.current, pagination.pageSize]);

    // ✅ build params & fetch: chỉ lấy field BE support, bỏ imei/plate
    const buildParams = useCallback(
        (opts = {}) => {
            const page = opts.page ?? pagination.current;
            const limit = opts.limit ?? pagination.pageSize;
            const filters = opts.filters !== undefined ? opts.filters : filterValues;

            return normalizeTripReportPayload({ filters, page, limit });
        },
        [filterValues, pagination.current, pagination.pageSize],
    );

    const fetchData = useCallback(
        async (opts = {}, { force = false } = {}) => {
            try {
                const params = buildParams(opts);

                if (opts.page === 1) setPagination((p) => ({ ...p, current: 1 }));
                setQueryParams(params);

                if (force) {
                    const key = makeKey(userId, params);
                    await globalMutate(key, fetcher, { revalidate: true });
                }
            } catch (err) {
                console.error(err);
                // message.error(isEn ? 'Failed to load trip report' : 'Không tải được trip report');
            }
        },
        [buildParams, globalMutate, fetcher, userId, isEn],
    );

    // initial
    useEffect(() => {
        const values = form?.getFieldsValue?.() || {};
        setFilterValues(values);
        fetchData({ page: 1, filters: values }, { force: false });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

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
