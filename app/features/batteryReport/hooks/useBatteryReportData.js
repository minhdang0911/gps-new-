// features/batteryReport/hooks/useBatteryReportData.js
import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { message } from 'antd';
import dayjs from 'dayjs';
import { normalize } from '../utils';
import { attachLicensePlate } from '../../../util/deviceMap';

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
function makeKey(prefix, params) {
    return params ? [prefix, stableStringify(params)] : null;
}

export function useBatteryReportData({ form, getBatteryReport, getUserList, imeiToPlate, isEn, t }) {
    const { mutate: globalMutate } = useSWRConfig();

    // ===== UI state =====
    const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
    const [tableScrollY, setTableScrollY] = useState(400);

    const [filterValues, _setFilterValues] = useState({});
    const [sortMode, _setSortMode] = useState('none'); // dropdown sort
    const [tableSorter, setTableSorter] = useState({ field: null, order: null });

    // ===== SWR params =====
    // ✅ IMPORTANT: null => mount không fetch. Khi set params => đọc cache (cache miss => fetch)
    const [reportParams, setReportParams] = useState(null);

    // ===== Distributors via SWR =====
    const distributorFetcher = useCallback(async () => {
        const res = await getUserList({ position: 'distributor' });
        const items = res?.items || res?.data || [];
        const map = {};
        items.forEach((item) => {
            const label = (item.name && item.name.trim()) || item.email || item.username;
            map[item._id] = label;
        });
        return map;
    }, [getUserList]);

    const swrDistributor = useSWR('batteryReport:distributors', distributorFetcher, {
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        revalidateIfStale: false,
        dedupingInterval: 30 * 60 * 1000,
        shouldRetryOnError: false,
    });

    const distributorMap = swrDistributor.data || {};

    const getDistributorLabel = useCallback(
        (id) => {
            if (!id) return '';
            return distributorMap[id] || id;
        },
        [distributorMap],
    );

    // ===== Build payload for BE =====
    const buildQueryPayload = useCallback((values, page, limit, sorter) => {
        const payload = { page, limit };

        if (values?.license_plate) payload.license_plate = String(values.license_plate).trim();
        if (values?.imei) payload.imei = String(values.imei).trim();
        if (values?.batteryId) payload.batteryId = String(values.batteryId).trim();
        if (values?.connectionStatus) payload.connectionStatus = values.connectionStatus;
        if (values?.utilization) payload.utilization = values.utilization;

        if (values?.timeRange?.length === 2) {
            payload.start = values.timeRange[0].startOf('day').format('YYYY-MM-DD HH:mm:ss');
            payload.end = values.timeRange[1].endOf('day').format('YYYY-MM-DD HH:mm:ss');
        }

        if (values?.__sortMode && values.__sortMode !== 'none') {
            payload.sort = values.__sortMode;
        }

        // sorter theo cột BE
        if (sorter?.field && sorter?.order) {
            payload.sortField = sorter.field;
            payload.sortOrder = sorter.order === 'ascend' ? 'asc' : 'desc';
        }

        return payload;
    }, []);

    // ===== SWR fetch battery report =====
    const reportFetcher = useCallback(
        async ([, paramsJson]) => {
            const payload = JSON.parse(paramsJson);
            return getBatteryReport(payload);
        },
        [getBatteryReport],
    );

    const swrKey = useMemo(() => makeKey('batteryReport:list', reportParams), [reportParams]);

    const swrReport = useSWR(swrKey, reportFetcher, {
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        revalidateIfStale: false,
        keepPreviousData: true,
        dedupingInterval: 5 * 60 * 1000,
        shouldRetryOnError: false,
        // ❌ không set revalidateOnMount:false (cache miss => fetch vẫn chạy)
    });

    const loading = swrReport.isLoading || swrReport.isValidating || swrDistributor.isLoading;

    // raw list từ BE
    const apiList = useMemo(() => {
        const res = swrReport.data;
        return res?.data || res?.items || [];
    }, [swrReport.data]);

    // enrich plate theo imeiToPlate
    const rawData = useMemo(() => {
        try {
            return attachLicensePlate(apiList, imeiToPlate);
        } catch (e) {
            console.error(e);
            return apiList;
        }
    }, [apiList, imeiToPlate]);

    // sync total từ BE
    useEffect(() => {
        const res = swrReport.data;
        if (!res) return;

        const list = apiList || [];
        const total = res?.total ?? res?.pagination?.total ?? list.length;

        setPagination((p) => ({
            ...p,
            total: Number(total) || 0,
        }));
    }, [swrReport.data, apiList]);

    // error toast
    useEffect(() => {
        if (swrDistributor.error) {
            console.error('Lỗi lấy danh sách đại lý: ', swrDistributor.error);
        }
    }, [swrDistributor.error]);

    useEffect(() => {
        if (!swrReport.error) return;
        console.error('Lỗi lấy battery report: ', swrReport.error);
        message.error(isEn ? 'Failed to load battery report' : 'Không tải được báo cáo pin');
    }, [swrReport.error, isEn]);

    // ===== responsive height =====
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const calcTableHeight = () => {
            const reserved = 320;
            const h = window.innerHeight - reserved;
            setTableScrollY(h > 300 ? h : 300);
        };
        calcTableHeight();
        window.addEventListener('resize', calcTableHeight);
        return () => window.removeEventListener('resize', calcTableHeight);
    }, []);

    // ===== FE processedData =====
    const processedData = useMemo(() => {
        const values = filterValues || {};
        const { imei, license_plate, batteryId, connectionStatus, utilization, timeRange } = values;

        let rows = Array.isArray(rawData) ? [...rawData] : [];

        if (license_plate) {
            const key = normalize(license_plate);
            rows = rows.filter((item) => normalize(item.license_plate).includes(key));
        }
        if (imei) {
            const key = normalize(imei);
            rows = rows.filter((item) => normalize(item.imei).includes(key));
        }
        if (batteryId) {
            const key = normalize(batteryId);
            rows = rows.filter((item) => normalize(item.batteryId).includes(key));
        }
        if (connectionStatus) rows = rows.filter((item) => item.connectionStatus === connectionStatus);
        if (utilization) rows = rows.filter((item) => item.utilization === utilization);

        if (timeRange && timeRange.length === 2) {
            const start = timeRange[0].startOf('day').valueOf();
            const end = timeRange[1].endOf('day').valueOf();
            rows = rows.filter((item) => {
                const d = item.date ? dayjs(item.date).valueOf() : NaN;
                return Number.isFinite(d) && d >= start && d <= end;
            });
        }

        return rows;
    }, [rawData, filterValues]);

    // ✅ tableData phải slice theo pagination
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

    const totalRecords = pagination.total;

    // ===== Setters reset page =====
    const setFilterValues = useCallback((next) => {
        setPagination((p) => ({ ...p, current: 1 }));
        _setFilterValues((prev) => (typeof next === 'function' ? next(prev) : next));
    }, []);

    const setSortMode = useCallback((next) => {
        setPagination((p) => ({ ...p, current: 1 }));
        _setSortMode(next);
    }, []);

    // ===== build params helper =====
    const buildParams = useCallback(
        (opts = {}) => {
            const page = opts.page ?? pagination.current;
            const pageSize = opts.pageSize ?? pagination.pageSize;

            const nextFilters = opts.filters !== undefined ? opts.filters : filterValues;
            const nextSortMode = opts.sortMode !== undefined ? opts.sortMode : sortMode;
            const nextSorter = opts.sorter !== undefined ? opts.sorter : tableSorter;

            return buildQueryPayload({ ...nextFilters, __sortMode: nextSortMode }, page, pageSize, nextSorter);
        },
        [pagination.current, pagination.pageSize, filterValues, sortMode, tableSorter, buildQueryPayload],
    );

    // ✅ Force fetch only when user action
    const forceFetch = useCallback(
        async (params) => {
            const key = makeKey('batteryReport:list', params);
            await globalMutate(key, reportFetcher, { revalidate: true });
        },
        [globalMutate, reportFetcher],
    );

    /**
     * ✅ fetchData:
     * - setReportParams để key thay đổi / đọc cache
     * - nếu force=true => gọi API ngay
     */
    const fetchData = useCallback(
        async (opts = {}) => {
            const params = buildParams(opts);
            setReportParams(params);

            if (opts.force) {
                await forceFetch(params);
            }
        },
        [buildParams, forceFetch],
    );

    // ✅ initial: chỉ set params để "đọc cache" (cache miss => fetch 1 lần)
    useEffect(() => {
        fetchData({ page: 1, pageSize: pagination.pageSize, force: false });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ===== Actions used by UI =====

    const onSearch = useCallback(async () => {
        const values = form.getFieldsValue();
        setFilterValues(values);
        setPagination((p) => ({ ...p, current: 1 }));

        await fetchData({
            page: 1,
            pageSize: pagination.pageSize,
            filters: values,
            sortMode,
            sorter: tableSorter,
            force: true, // ✅ user action => force
        });
    }, [form, fetchData, pagination.pageSize, setFilterValues, sortMode, tableSorter]);

    const onReset = useCallback(async () => {
        form.resetFields();
        setFilterValues({});
        setSortMode('none');
        setTableSorter({ field: null, order: null });
        setPagination((p) => ({ ...p, current: 1 }));

        await fetchData({
            page: 1,
            pageSize: pagination.pageSize,
            filters: {},
            sortMode: 'none',
            sorter: { field: null, order: null },
            force: true, // ✅ user action => force
        });
    }, [form, fetchData, pagination.pageSize, setFilterValues, setSortMode]);

    const handleTableChange = useCallback(
        async (pager, _filters, sorter) => {
            const nextPage = pager.current;
            const nextSize = pager.pageSize;

            const s = Array.isArray(sorter) ? sorter[0] : sorter;
            const nextSorter = {
                field: s?.field || s?.columnKey || null,
                order: s?.order || null,
            };

            const sorterChanged = nextSorter.field !== tableSorter.field || nextSorter.order !== tableSorter.order;

            const finalPage = sorterChanged ? 1 : nextPage;

            setPagination((p) => ({ ...p, current: finalPage, pageSize: nextSize }));
            setTableSorter(nextSorter);

            await fetchData({
                page: finalPage,
                pageSize: nextSize,
                filters: filterValues,
                sortMode,
                sorter: nextSorter,
                force: true, // ✅ table interaction => force
            });
        },
        [fetchData, filterValues, sortMode, tableSorter],
    );

    const fetchDistributors = useCallback(() => swrDistributor.mutate(), [swrDistributor]);
    const mutate = useCallback(() => swrReport.mutate(), [swrReport]);

    return {
        loading,
        rawData,
        distributorMap,
        getDistributorLabel,

        pagination,
        setPagination,
        tableScrollY,

        sortMode,
        setSortMode,
        filterValues,
        setFilterValues,

        tableSorter,
        setTableSorter,

        processedData,
        totalRecords,
        tableData,

        fetchData,
        fetchDistributors,
        onSearch,
        onReset,
        handleTableChange,

        mutate,
    };
}
