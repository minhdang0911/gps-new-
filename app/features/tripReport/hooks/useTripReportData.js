import { useEffect, useMemo, useState, useCallback } from 'react';
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
    const [loading, setLoading] = useState(false);

    // rawData = dữ liệu 1 trang trả về từ BE
    const [rawData, setRawData] = useState([]);

    const [filterValues, setFilterValues] = useState({});
    const [sortMode, setSortMode] = useState('none');

    // total lấy theo BE
    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 10,
        total: 0,
    });

    const fetchData = useCallback(
        async (opts = {}) => {
            const page = opts.page ?? pagination.current;
            const limit = opts.limit ?? pagination.pageSize;

            try {
                setLoading(true);

                const extraParams = buildTripReportParams(filterValues, sortMode);

                const res = await getTripReport({
                    page,
                    limit,
                    ...extraParams,
                });

                const list = res?.data || res?.items || [];
                const total = Number(res?.total ?? 0);

                const enriched = attachLicensePlate(list, imeiToPlate);

                setRawData(enriched);
                setPagination((p) => ({
                    ...p,
                    current: page,
                    pageSize: limit,
                    total,
                }));
            } catch (err) {
                console.error('Lỗi lấy trip report: ', err);
                message.error(isEn ? 'Failed to load trip report' : 'Không tải được trip report');
            } finally {
                setLoading(false);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [
            getTripReport,
            attachLicensePlate,
            imeiToPlate,
            isEn,
            filterValues,
            sortMode,
            pagination.current,
            pagination.pageSize,
        ],
    );

    // Load lần đầu (khi map device sẵn sàng)
    useEffect(() => {
        if (loadingDeviceMap) return;
        fetchData({ page: 1 });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadingDeviceMap, imeiToPlate]);

    // Khi filter/sort đổi -> reset về page 1 và refetch
    useEffect(() => {
        setPagination((p) => ({ ...p, current: 1 }));
        if (loadingDeviceMap) return;
        fetchData({ page: 1 });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterValues, sortMode]);

    /**
     * Nếu BE đã filter/sort đầy đủ -> processedData = rawData
     * Nếu BE chưa hỗ trợ, bạn có thể dùng applyFilterSortTripReport cho "lọc trong 1 trang" (không khuyến nghị)
     */
    const processedData = useMemo(() => {
        // Option A (khuyến nghị khi BE làm chuẩn):
        // return rawData;

        // Option B (nếu muốn giữ UI filter/sort tạm thời trong 1 trang):
        return applyFilterSortTripReport({ rawData, filterValues, sortMode });
    }, [rawData, filterValues, sortMode]);

    const totalRecords = pagination.total;

    // Dữ liệu cho table + số thứ tự
    const tableData = useMemo(() => {
        return (processedData || []).map((row, idx) => ({
            ...row,
            __rowNo: (pagination.current - 1) * pagination.pageSize + idx + 1,
        }));
    }, [processedData, pagination.current, pagination.pageSize]);

    // Dùng cho antd Table onChange
    const onTableChange = useCallback(
        (p) => {
            fetchData({ page: p.current, limit: p.pageSize });
        },
        [fetchData],
    );

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
    };
}
