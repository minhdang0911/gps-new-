// features/tripReport/hooks/useTripReportData.js
import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import dayjs from 'dayjs';
import { useAuthStore } from '../../../stores/authStore';
import { stableStringify } from '../../_shared/swrKey';
import { applyFilterSortTripReport } from '../utils';

// ========= helpers =========
const normStr = (v) => (typeof v === 'string' ? v.trim() : '');
const normalizePlate = (s) =>
    (s || '').toString().trim().toUpperCase().replace(/\s+/g, '').replace(/[._]/g, '-').replace(/--+/g, '-');

const getRowImei = (row) => normStr(String(row?.imei ?? row?.IMEI ?? row?.deviceImei ?? row?.device?.imei ?? ''));

// ✅ build payload gửi BE (BE KHÔNG support timeRange)
function normalizeTripReportPayload({ filters = {}, page = 1, limit = 10 }) {
    return {
        page,
        limit,

        // ✅ chỉ gửi những field BE support
        motorcycleId: filters?.motorcycleId ? normStr(filters.motorcycleId) : undefined,
        connectionStatus: filters?.connectionStatus || undefined,
        movementStatus: filters?.movementStatus || undefined,
        lockStatus: filters?.lockStatus || undefined,

        // ❌ không gửi:
        // timeRange/startDate/endDate
        // imei
        // license_plate
    };
}

function makeKey(userId, params) {
    return params ? ['tripReport', userId || 'guest', stableStringify(params)] : null;
}

// ===== timeRange filter FE (date-only, tránh lệch timezone) =====
function inRangeByDay(rowDate, start, end) {
    if (!rowDate || !start || !end) return true;

    const d = dayjs(rowDate);
    if (!d.isValid()) return false;

    const ds = d.startOf('day').valueOf();
    const s = dayjs(start).startOf('day').valueOf();
    const e = dayjs(end).endOf('day').valueOf();

    return ds >= s && ds <= e;
}

export function useTripReportData({
    form,
    getTripReport,
    isEn, // giữ để bạn dùng message nếu muốn
    t, // giữ để bạn dùng message nếu muốn
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

    // ✅ FULL mode: có timeRange => lấy ALL rồi filter/paginate ở FE
    const needFullData = useMemo(() => {
        const tr = filterValues?.timeRange;
        return Array.isArray(tr) && tr.length === 2 && tr[0] && tr[1];
    }, [filterValues]);

    // store full list (khi needFullData)
    const [fullData, setFullData] = useState([]);

    const fetcher = useCallback(
        async ([, , paramsJson]) => {
            const params = JSON.parse(paramsJson);
            const res = await getTripReport(params);
            return res;
        },
        [getTripReport],
    );

    const swrKey = useMemo(() => makeKey(userId, queryParams), [queryParams, userId]);

    const swr = useSWR(swrKey, fetcher, {
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        revalidateIfStale: false,
        keepPreviousData: true,
        dedupingInterval: 5 * 60 * 1000,
        shouldRetryOnError: false,
    });

    const loading = swr.isLoading || swr.isValidating;

    const body = useMemo(() => swr.data ?? null, [swr.data]);

    // ===== raw page data + attach plate =====
    const pageData = useMemo(() => {
        const list = body?.data || [];
        try {
            if (!attachLicensePlate) return list;
            if (!imeiToPlate || imeiToPlate.size === 0) return list;
            return attachLicensePlate(list, imeiToPlate);
        } catch {
            return list;
        }
    }, [body, attachLicensePlate, imeiToPlate]);

    // ===== derived FE filters: license_plate -> imeis =====
    const derivedFilters = useMemo(() => {
        const values = filterValues || {};
        const plateInputRaw = normStr(values?.license_plate || '');
        const plateKey = plateInputRaw ? normalizePlate(plateInputRaw) : '';
        const imeiInput = normStr(values?.imei || '');

        const mappedImeis = plateKey ? plateToImeis?.get?.(plateKey) || [] : [];

        return {
            ...values,
            __plateKey: plateKey,
            __mappedImeis: mappedImeis,
            __imeiInput: imeiInput,
        };
    }, [filterValues, plateToImeis]);

    // ===== FETCH ALL when needFullData =====
    const fetchAllPages = useCallback(
        async (filters) => {
            const LIMIT = 200; // nếu BE cho lớn hơn thì tăng lên
            let page = 1;
            let total = Infinity;
            const out = [];

            while (out.length < total) {
                const params = normalizeTripReportPayload({ filters, page, limit: LIMIT });
                const res = await getTripReport(params);

                // response flat: { page, limit, total, data }
                const rows = res?.data || [];
                const totalFromBE = Number(res?.total ?? 0);

                if (Number.isFinite(totalFromBE) && totalFromBE >= 0) total = totalFromBE;
                out.push(...rows);

                if (!rows.length) break; // safety
                if (rows.length < LIMIT) break; // last page
                page += 1;

                // safety guard tránh loop vô hạn nếu BE trả total sai
                if (page > 1000) break;
            }

            // attach plate cho full list
            try {
                if (attachLicensePlate && imeiToPlate && imeiToPlate.size > 0) {
                    return attachLicensePlate(out, imeiToPlate);
                }
            } catch {
                // ignore
            }
            return out;
        },
        [getTripReport, attachLicensePlate, imeiToPlate],
    );

    // ===== base list: fullData (khi needFullData) hoặc pageData =====
    const rawData = useMemo(() => {
        return needFullData ? fullData : pageData;
    }, [needFullData, fullData, pageData]);

    // ===== apply filter + sort (FE) =====
    const processedData = useMemo(() => {
        // 1) filter/sort theo util (không timeRange) — vì timeRange ta tự xử lý chuẩn day-only
        const { timeRange, ...rest } = derivedFilters || {};

        const base = applyFilterSortTripReport({
            rawData,
            filterValues: rest,
            sortMode,
        });

        // 2) timeRange FE filter (date-only)
        let after = base || [];
        if (needFullData && Array.isArray(timeRange) && timeRange[0] && timeRange[1]) {
            after = after.filter((row) => inRangeByDay(row?.date, timeRange[0], timeRange[1]));
        }

        // 3) IMEI / Plate filter (FE)
        const plateKey = derivedFilters.__plateKey;
        const mappedImeis = derivedFilters.__mappedImeis || [];
        const imeiInput = derivedFilters.__imeiInput;

        if (imeiInput) return after.filter((row) => getRowImei(row).includes(imeiInput));

        if (plateKey && mappedImeis.length > 0) {
            const set = new Set(mappedImeis.map((x) => normStr(String(x))));
            return after.filter((row) => set.has(getRowImei(row)));
        }

        if (plateKey && mappedImeis.length === 0) {
            return after.filter((row) => normalizePlate(row?.license_plate || '').includes(plateKey));
        }

        return after;
    }, [rawData, derivedFilters, sortMode, needFullData]);

    // ===== pagination: server mode dùng total BE; full mode dùng processedData.length =====
    useEffect(() => {
        if (needFullData) {
            setPagination((p) => ({ ...p, total: processedData.length }));
            return;
        }

        if (!body) return;

        const totalFromBE = Number(body.total ?? 0);
        const limitFromBE = Number(body.limit ?? pagination.pageSize);
        const pageFromBE = Number(body.page ?? pagination.current);

        if (Number.isFinite(totalFromBE) && totalFromBE >= 0) {
            setPagination((p) => ({
                ...p,
                total: totalFromBE,
                pageSize: Number.isFinite(limitFromBE) && limitFromBE > 0 ? limitFromBE : p.pageSize,
                current: Number.isFinite(pageFromBE) && pageFromBE > 0 ? pageFromBE : p.current,
            }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [body, needFullData, processedData.length]);

    // clamp current
    useEffect(() => {
        const total = pagination.total || 0;
        const pageSize = pagination.pageSize || 10;
        const maxPage = Math.max(1, Math.ceil(total / pageSize));

        if (pagination.current > maxPage) {
            setPagination((p) => ({ ...p, current: 1 }));
        }
    }, [pagination.total, pagination.pageSize, pagination.current]);

    // ===== tableData =====
    const tableData = useMemo(() => {
        const { current, pageSize } = pagination;

        // server mode: BE đã trả đúng 1 page => dùng processedData trực tiếp
        if (!needFullData) {
            const list = processedData || [];
            return list.map((row, idx) => ({
                ...row,
                __rowNo: (current - 1) * pageSize + idx + 1,
            }));
        }

        // full mode: slice theo FE pagination
        const start = (current - 1) * pageSize;
        const end = start + pageSize;
        const sliced = (processedData || []).slice(start, end);

        return sliced.map((row, idx) => ({
            ...row,
            __rowNo: (current - 1) * pageSize + idx + 1,
        }));
    }, [processedData, pagination.current, pagination.pageSize, needFullData]);

    // ✅ build params & fetch
    const buildParams = useCallback(
        (opts = {}) => {
            const page = opts.page ?? pagination.current;
            const limit = opts.limit ?? opts.pageSize ?? pagination.pageSize;
            const filters = opts.filters !== undefined ? opts.filters : filterValues;

            return normalizeTripReportPayload({ filters, page, limit });
        },
        [filterValues, pagination.current, pagination.pageSize],
    );

    const fetchData = useCallback(
        async (opts = {}, { force = false } = {}) => {
            try {
                const filters = opts.filters !== undefined ? opts.filters : filterValues;

                // ✅ nếu có timeRange -> fetch ALL rồi filter FE
                const hasTimeRange =
                    Array.isArray(filters?.timeRange) &&
                    filters.timeRange.length === 2 &&
                    filters.timeRange[0] &&
                    filters.timeRange[1];

                if (hasTimeRange) {
                    // reset pagination về page 1
                    setPagination((p) => ({ ...p, current: 1 }));

                    const all = await fetchAllPages(filters);
                    setFullData(all);
                    // không cần setQueryParams trong full mode (tránh SWR override)
                    return;
                }

                // ✅ server mode
                setFullData([]); // clear full cache
                const params = buildParams(opts);

                if (opts.page === 1) setPagination((p) => ({ ...p, current: 1 }));
                setQueryParams(params);

                if (force) {
                    const key = makeKey(userId, params);
                    await globalMutate(key, fetcher, { revalidate: true });
                }
            } catch (err) {
                console.error(err);
            }
        },
        [filterValues, buildParams, globalMutate, fetcher, userId, fetchAllPages],
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

        // raw list used for FE processing (full or page)
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
