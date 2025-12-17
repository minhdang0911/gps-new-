import { useEffect, useMemo, useState } from 'react';
import { message } from 'antd';
import dayjs from 'dayjs';
import { normalize } from '../utils';
import { attachLicensePlate } from '../../../util/deviceMap';

export function useBatteryReportData({ form, getBatteryReport, getUserList, imeiToPlate, isEn, t }) {
    const [distributorMap, setDistributorMap] = useState({});
    const [rawData, setRawData] = useState([]);
    const [loading, setLoading] = useState(false);

    // ✅ BE paginate
    const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
    const [tableScrollY, setTableScrollY] = useState(400);

    const [filterValues, setFilterValues] = useState({});
    const [sortMode, setSortMode] = useState('none'); // dropdown sort
    const [tableSorter, setTableSorter] = useState({ field: null, order: null }); // ✅ sorter per column

    const getDistributorLabel = (id) => {
        if (!id) return '';
        return distributorMap[id] || id;
    };

    const fetchDistributors = async () => {
        try {
            const res = await getUserList({ position: 'distributor' });
            const items = res?.items || res?.data || [];
            const map = {};
            items.forEach((item) => {
                const label = (item.name && item.name.trim()) || item.email || item.username;
                map[item._id] = label;
            });
            setDistributorMap(map);
        } catch (err) {
            console.error('Lỗi lấy danh sách đại lý: ', err);
        }
    };

    const buildQueryPayload = (values, page, limit, sorter) => {
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

        // ✅ sort theo cột BE (full dataset)
        if (sorter?.field && sorter?.order) {
            payload.sortField = sorter.field;
            payload.sortOrder = sorter.order === 'ascend' ? 'asc' : 'desc';
        }

        return payload;
    };

    const fetchData = async (page = pagination.current, pageSize = pagination.pageSize, sorter = tableSorter) => {
        try {
            setLoading(true);

            const payload = buildQueryPayload({ ...filterValues, __sortMode: sortMode }, page, pageSize, sorter);

            const res = await getBatteryReport(payload);

            const list = res?.data || res?.items || [];
            const total = res?.total ?? res?.pagination?.total ?? list.length;

            const enriched = attachLicensePlate(list, imeiToPlate);

            setRawData(enriched);
            setPagination((p) => ({
                ...p,
                current: page,
                pageSize,
                total,
            }));
        } catch (err) {
            console.error('Lỗi lấy battery report: ', err);
            message.error(isEn ? 'Failed to load battery report' : 'Không tải được báo cáo pin');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDistributors();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        fetchData(1, pagination.pageSize);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [imeiToPlate]);

    // ✅ responsive height
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

    // ✅ processedData (FE filter bổ sung nếu cần)
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

    const totalRecords = pagination.total;

    const tableData = useMemo(() => {
        return (processedData || []).map((row, idx) => ({
            ...row,
            __rowNo: (pagination.current - 1) * pagination.pageSize + idx + 1,
        }));
    }, [processedData, pagination.current, pagination.pageSize]);

    const onSearch = () => {
        const values = form.getFieldsValue();
        setFilterValues(values);
        setPagination((p) => ({ ...p, current: 1 }));
        fetchData(1, pagination.pageSize);
    };

    const onReset = () => {
        form.resetFields();
        setFilterValues({});
        setSortMode('none');
        setTableSorter({ field: null, order: null });
        setPagination((p) => ({ ...p, current: 1 }));
        fetchData(1, pagination.pageSize, { field: null, order: null });
    };

    const handleTableChange = (pager, _filters, sorter) => {
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

        fetchData(finalPage, nextSize, nextSorter);
    };

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
    };
}
