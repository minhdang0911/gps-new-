import { useEffect, useMemo, useState } from 'react';
import { message } from 'antd';
import { API_SAFE_LIMIT } from '../constants';
import { attachPlateToLastCruise, applyClientFilterSort } from '../utils';

export function useLastCruiseData({ form, getLastCruiseList, imeiToPlate, isEn, t }) {
    const [rawData, setRawData] = useState([]);
    const [loading, setLoading] = useState(false);

    const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
    const [filterValues, setFilterValues] = useState({});
    const [sortMode, setSortMode] = useState('none'); // none | newest | oldest

    const fetchData = async () => {
        try {
            setLoading(true);

            const res = await getLastCruiseList({ page: 1, limit: API_SAFE_LIMIT });
            const list = res?.data || res || [];

            const enriched = attachPlateToLastCruise(list, imeiToPlate);
            setRawData(enriched);
            setPagination((p) => ({ ...p, current: 1 }));

            if (enriched.length >= API_SAFE_LIMIT) {
                message.warning(
                    isEn
                        ? `Data may be truncated (limit=${API_SAFE_LIMIT}). Consider increasing API_SAFE_LIMIT.`
                        : `Dữ liệu có thể bị cắt (limit=${API_SAFE_LIMIT}). Cân nhắc tăng API_SAFE_LIMIT.`,
                );
            }
        } catch (err) {
            console.error('Lỗi lấy last cruise list: ', err);
            message.error(isEn ? 'Failed to load last cruise list' : 'Không tải được danh sách vị trí cuối');
        } finally {
            setLoading(false);
        }
    };

    // refetch when map ready (attach plate)
    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [imeiToPlate]);

    const processedData = useMemo(() => {
        return applyClientFilterSort({ rawData, filterValues, sortMode });
    }, [rawData, filterValues, sortMode]);

    useEffect(() => {
        setPagination((p) => ({ ...p, current: 1 }));
    }, [filterValues, sortMode]);

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

    const onSearch = () => {
        // dữ liệu đã fetch full; chỉ cần setFilterValues ở page là đủ
        // nhưng để đồng bộ, vẫn giữ fn này (nếu sau muốn refetch theo filter)
    };

    const onReset = () => {
        form.resetFields();
        setFilterValues({});
        setSortMode('none');
        setPagination((p) => ({ ...p, current: 1 }));
    };

    const handleTableChange = (pager) => {
        setPagination({ current: pager.current, pageSize: pager.pageSize });
    };

    return {
        rawData,
        setRawData,
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
    };
}
