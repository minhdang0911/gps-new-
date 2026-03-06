import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import dayjs from 'dayjs';
import { normalize } from '../utils';
import { attachLicensePlate } from '../../../util/deviceMap';
import { useAuthStore } from '../../../stores/authStore';
import { makeUserKey } from '../../_shared/swrKey';

const normStr = (v) => (typeof v === 'string' ? v.trim() : '');
const normalizePlate = (s) =>
    (s || '').toString().trim().toUpperCase().replace(/\s+/g, '').replace(/[._]/g, '-').replace(/--+/g, '-');

// ✅ lấy imei từ nhiều field (đỡ fail do key khác nhau)
const getRowImei = (row) => {
    const v = row?.imei ?? row?.IMEI ?? row?.deviceImei ?? row?.device?.imei ?? '';
    return normStr(String(v));
};

// ✅ API này không hỗ trợ timeRange đúng nghĩa => fetch all rồi filter FE
const MAX_LIMIT = 50000;

export function useBatteryReportData({ form, getBatteryReport, getUserList, imeiToPlate, plateToImeis, isEn, t }) {
    const userId = useAuthStore((s) => s.user?._id) || 'guest';

    const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
    const [tableScrollY, setTableScrollY] = useState(800);

    const [filterValues, _setFilterValues] = useState({});
    const [sortMode, _setSortMode] = useState('none');
    const [tableSorter, setTableSorter] = useState({ field: null, order: null });

    const [reportParams, setReportParams] = useState(null);

    // distributors...
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

    const swrDistributor = useSWR(['batteryReport:distributors', userId], distributorFetcher, {
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        revalidateIfStale: false,
        dedupingInterval: 30 * 60 * 1000,
        shouldRetryOnError: false,
    });

    const distributorMap = swrDistributor.data || {};
    const getDistributorLabel = useCallback((id) => (id ? distributorMap[id] || id : ''), [distributorMap]);

    /**
     * ✅ Build payload: vẫn giữ fields khác nếu BE support,
     * nhưng CHỐT: luôn page=1 + limit=MAX_LIMIT để FE filter/paginate.
     */
    const buildQueryPayload = useCallback((values, sorter) => {
        const payload = { page: 1, limit: MAX_LIMIT };

        // vẫn gửi lên nếu BE có support 1 phần
        if (values?.license_plate) payload.license_plate = String(values.license_plate).trim();
        if (values?.imei) payload.imei = String(values.imei).trim();

        if (values?.batteryId) payload.batteryId = String(values.batteryId).trim();
        if (values?.connectionStatus) payload.connectionStatus = values.connectionStatus;
        if (values?.utilization) payload.utilization = values.utilization;

        // ❗timeRange: BE không support thì cũng OK, FE sẽ filter
        if (values?.timeRange?.length === 2) {
            payload.start = values.timeRange[0].startOf('day').format('YYYY-MM-DD HH:mm:ss');
            payload.end = values.timeRange[1].endOf('day').format('YYYY-MM-DD HH:mm:ss');
        }

        if (values?.__sortMode && values.__sortMode !== 'none') payload.sort = values.__sortMode;

        if (sorter?.field && sorter?.order) {
            payload.sortField = sorter.field;
            payload.sortOrder = sorter.order === 'ascend' ? 'asc' : 'desc';
        }

        // ✅ force refresh SWR key when needed
        payload._t = Date.now();

        return payload;
    }, []);

    const reportFetcher = useCallback(
        async ([, , paramsJson]) => {
            const payload = JSON.parse(paramsJson);
            return getBatteryReport(payload);
        },
        [getBatteryReport],
    );

    const swrReport = useSWR(makeUserKey(userId, 'batteryReport:list', reportParams), reportFetcher, {
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        revalidateIfStale: false,
        keepPreviousData: true,
        dedupingInterval: 2 * 60 * 1000,
        shouldRetryOnError: false,
    });

    const loading = swrReport.isLoading || swrReport.isValidating || swrDistributor.isLoading;

    const apiList = useMemo(() => {
        const res = swrReport.data;
        return res?.data || res?.items || [];
    }, [swrReport.data]);

    // ✅ attach plate
    const rawData = useMemo(() => {
        try {
            if (!imeiToPlate || !(imeiToPlate instanceof Map) || imeiToPlate.size === 0) return apiList;
            return attachLicensePlate(apiList, imeiToPlate);
        } catch (e) {
            console.error(e);
            return apiList;
        }
    }, [apiList, imeiToPlate]);

    // ✅ FE filter: plate -> imei, imei, batteryId, status, utilization, timeRange
    const processedData = useMemo(() => {
        const values = filterValues || {};
        const { imei, license_plate, batteryId, connectionStatus, utilization, timeRange } = values;

        let rows = Array.isArray(rawData) ? [...rawData] : [];

        // 1) plate -> imei set
        const plateKey = license_plate ? normalizePlate(license_plate) : '';
        if (plateKey && plateToImeis && plateToImeis instanceof Map) {
            const mappedImeis = plateToImeis.get(plateKey) || [];
            if (mappedImeis.length > 0) {
                const set = new Set(mappedImeis.map((x) => normStr(String(x))));
                rows = rows.filter((item) => set.has(getRowImei(item)));
            } else {
                rows = rows.filter((item) => normalizePlate(item?.license_plate || '').includes(plateKey));
            }
        } else if (plateKey) {
            rows = rows.filter((item) => normalizePlate(item?.license_plate || '').includes(plateKey));
        }

        // 2) imei
        if (imei) {
            const key = normalize(imei);
            rows = rows.filter((item) => normalize(getRowImei(item)).includes(key));
        }

        // 3) batteryId
        if (batteryId) {
            const key = normalize(batteryId);
            rows = rows.filter((item) => normalize(item?.batteryId).includes(key));
        }

        // 4) status filters
        if (connectionStatus) rows = rows.filter((item) => item?.connectionStatus === connectionStatus);
        if (utilization) rows = rows.filter((item) => item?.utilization === utilization);

        // 5) timeRange filter FE
        if (timeRange && timeRange.length === 2) {
            const start = timeRange[0].startOf('day').valueOf();
            const end = timeRange[1].endOf('day').valueOf();

            rows = rows.filter((item) => {
                const d = item?.date ? dayjs(item.date).valueOf() : NaN;
                return Number.isFinite(d) && d >= start && d <= end;
            });
        }

        return rows;
    }, [rawData, filterValues, plateToImeis]);

    // ✅ total theo FE processed
    useEffect(() => {
        setPagination((p) => ({ ...p, total: processedData.length }));
    }, [processedData.length]);

    const setFilterValues = useCallback((next) => {
        setPagination((p) => ({ ...p, current: 1 }));
        _setFilterValues((prev) => (typeof next === 'function' ? next(prev) : next));
    }, []);

    const setSortMode = useCallback((next) => {
        setPagination((p) => ({ ...p, current: 1 }));
        _setSortMode(next);
    }, []);

    // ✅ fetch full data
    const fetchData = useCallback(() => {
        const payload = buildQueryPayload({ ...filterValues, __sortMode: sortMode }, tableSorter);
        setReportParams(payload);
    }, [buildQueryPayload, filterValues, sortMode, tableSorter]);

    // init
    useEffect(() => {
        setPagination((p) => ({ ...p, current: 1 }));
        setReportParams(null);

        // fetch full
        const payload = buildQueryPayload({ __sortMode: 'none' }, { field: null, order: null });
        setReportParams(payload);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    // FE pagination slice
    const tableData = useMemo(() => {
        const { current, pageSize } = pagination;
        const start = (current - 1) * pageSize;
        const end = start + pageSize;

        return processedData.slice(start, end).map((row, idx) => ({
            ...row,
            __rowNo: start + idx + 1,
        }));
    }, [processedData, pagination]);

    // clamp current when total changes
    useEffect(() => {
        const total = processedData.length;
        const pageSize = pagination.pageSize || 10;
        const maxPage = Math.max(1, Math.ceil(total / pageSize));
        if (pagination.current > maxPage) {
            setPagination((p) => ({ ...p, current: 1 }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [processedData.length, pagination.pageSize]);

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
        totalRecords: processedData.length,
        tableData,

        fetchData,

        onSearch: () => {
            const values = form.getFieldsValue();
            setFilterValues(values);
            setPagination((p) => ({ ...p, current: 1 }));
            fetchData();
        },

        onReset: () => {
            form.resetFields();
            setFilterValues({});
            setSortMode('none');
            setTableSorter({ field: null, order: null });
            setPagination((p) => ({ ...p, current: 1 }));

            const payload = buildQueryPayload({ __sortMode: 'none' }, { field: null, order: null });
            setReportParams(payload);
        },

        handleTableChange: (pager, _filters, sorter) => {
            const nextPage = pager.current;
            const nextSize = pager.pageSize;

            const s = Array.isArray(sorter) ? sorter[0] : sorter;
            const nextSorter = { field: s?.field || s?.columnKey || null, order: s?.order || null };

            setPagination((p) => ({ ...p, current: nextPage, pageSize: nextSize }));
            setTableSorter(nextSorter);

            // ✅ sort change => refetch full (optional)
            // nếu API sort không support thì bạn có thể bỏ fetchData() ở đây
            // fetchData();
        },

        mutate: swrReport.mutate,
    };
}
