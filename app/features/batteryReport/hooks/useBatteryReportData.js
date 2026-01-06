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

    const buildQueryPayload = useCallback((values, page, limit, sorter) => {
        const payload = { page, limit };

        // ✅ vẫn gửi lên BE như cũ (nếu BE có support)
        if (values?.license_plate) payload.license_plate = String(values.license_plate).trim();
        if (values?.imei) payload.imei = String(values.imei).trim();

        if (values?.batteryId) payload.batteryId = String(values.batteryId).trim();
        if (values?.connectionStatus) payload.connectionStatus = values.connectionStatus;
        if (values?.utilization) payload.utilization = values.utilization;

        if (values?.timeRange?.length === 2) {
            payload.start = values.timeRange[0].startOf('day').format('YYYY-MM-DD HH:mm:ss');
            payload.end = values.timeRange[1].endOf('day').format('YYYY-MM-DD HH:mm:ss');
        }

        if (values?.__sortMode && values.__sortMode !== 'none') payload.sort = values.__sortMode;

        if (sorter?.field && sorter?.order) {
            payload.sortField = sorter.field;
            payload.sortOrder = sorter.order === 'ascend' ? 'asc' : 'desc';
        }

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
        dedupingInterval: 5 * 60 * 1000,
        shouldRetryOnError: false,
    });

    const loading = swrReport.isLoading || swrReport.isValidating || swrDistributor.isLoading;

    const apiList = useMemo(() => {
        const res = swrReport.data;
        return res?.data || res?.items || [];
    }, [swrReport.data]);

    // ✅ attach plate bằng imeiToPlate (cache có thì dán ngay)
    const rawData = useMemo(() => {
        try {
            if (!imeiToPlate || !(imeiToPlate instanceof Map) || imeiToPlate.size === 0) return apiList;
            return attachLicensePlate(apiList, imeiToPlate);
        } catch (e) {
            console.error(e);
            return apiList;
        }
    }, [apiList, imeiToPlate]);

    useEffect(() => {
        const res = swrReport.data;
        if (!res) return;
        const total = res?.total ?? res?.pagination?.total ?? apiList.length;
        setPagination((p) => ({ ...p, total: Number(total) || 0 }));
    }, [swrReport.data, apiList.length]);

    // ✅ FE filter: ưu tiên biển số => map ra imei rồi lọc theo imei
    const processedData = useMemo(() => {
        const values = filterValues || {};
        const { imei, license_plate, batteryId, connectionStatus, utilization, timeRange } = values;

        let rows = Array.isArray(rawData) ? [...rawData] : [];

        // ===== 1) license plate => map => filter by IMEI =====
        const plateKey = license_plate ? normalizePlate(license_plate) : '';
        if (plateKey && plateToImeis && plateToImeis instanceof Map) {
            const mappedImeis = plateToImeis.get(plateKey) || [];
            if (mappedImeis.length > 0) {
                const set = new Set(mappedImeis.map((x) => normStr(String(x))));
                rows = rows.filter((item) => set.has(getRowImei(item)));
            } else {
                // fallback: nếu không map ra imei thì filter text trên license_plate (nếu row có)
                rows = rows.filter((item) => normalizePlate(item?.license_plate || '').includes(plateKey));
            }
        } else if (plateKey) {
            // fallback nếu chưa có map
            rows = rows.filter((item) => normalizePlate(item?.license_plate || '').includes(plateKey));
        }

        // ===== 2) imei =====
        if (imei) {
            const key = normalize(imei);
            rows = rows.filter((item) => normalize(getRowImei(item)).includes(key));
        }

        // ===== 3) other filters =====
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
    }, [rawData, filterValues, plateToImeis]);

    const setFilterValues = useCallback((next) => {
        setPagination((p) => ({ ...p, current: 1 }));
        _setFilterValues((prev) => (typeof next === 'function' ? next(prev) : next));
    }, []);

    const setSortMode = useCallback((next) => {
        setPagination((p) => ({ ...p, current: 1 }));
        _setSortMode(next);
    }, []);

    const fetchData = useCallback(
        (page = 1, pageSize = pagination.pageSize, sorter = tableSorter) => {
            const payload = buildQueryPayload({ ...filterValues, __sortMode: sortMode }, page, pageSize, sorter);
            setReportParams(payload);
        },
        [buildQueryPayload, filterValues, sortMode, pagination.pageSize, tableSorter],
    );

    useEffect(() => {
        setPagination((p) => ({ ...p, current: 1 }));
        setReportParams(null);
        fetchData(1, pagination.pageSize, { field: null, order: null });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    useEffect(() => {
        fetchData(1, pagination.pageSize, tableSorter);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
        totalRecords: pagination.total,
        tableData: processedData.map((row, idx) => ({
            ...row,
            __rowNo: (pagination.current - 1) * pagination.pageSize + idx + 1,
        })),

        fetchData,
        onSearch: () => {
            const values = form.getFieldsValue();
            setFilterValues(values);
            setPagination((p) => ({ ...p, current: 1 }));
            fetchData(1, pagination.pageSize, tableSorter);
        },
        onReset: () => {
            form.resetFields();
            setFilterValues({});
            setSortMode('none');
            setTableSorter({ field: null, order: null });
            setPagination((p) => ({ ...p, current: 1 }));

            const payload = buildQueryPayload({ __sortMode: 'none' }, 1, pagination.pageSize, {
                field: null,
                order: null,
            });
            setReportParams({ ...payload, _t: Date.now() });
        },
        handleTableChange: (pager, _filters, sorter) => {
            const nextPage = pager.current;
            const nextSize = pager.pageSize;

            const s = Array.isArray(sorter) ? sorter[0] : sorter;
            const nextSorter = { field: s?.field || s?.columnKey || null, order: s?.order || null };

            const sorterChanged = nextSorter.field !== tableSorter.field || nextSorter.order !== tableSorter.order;
            const finalPage = sorterChanged ? 1 : nextPage;

            setPagination((p) => ({ ...p, current: finalPage, pageSize: nextSize }));
            setTableSorter(nextSorter);
            fetchData(finalPage, nextSize, nextSorter);
        },
        mutate: swrReport.mutate,
    };
}
