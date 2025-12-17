// features/usageSessionReport/hooks/useUsageSessionData.js
import { useEffect, useMemo, useState } from 'react';
import { message } from 'antd';
import { API_SAFE_LIMIT } from '../constants';
import { buildParams } from '../utils';

export function useUsageSessionData({ form, getUsageSessions, isEn, t }) {
    const [serverData, setServerData] = useState([]);
    const [fullData, setFullData] = useState([]);
    const [loading, setLoading] = useState(false);

    const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

    const [sortMode, setSortMode] = useState('none');
    const [tableFilters, setTableFilters] = useState({ vehicleId: null, batteryId: null });
    const [groupBy, setGroupBy] = useState('none');

    const needFullData = useMemo(() => {
        const hasTableFilter = tableFilters.vehicleId?.length || tableFilters.batteryId?.length;
        return sortMode !== 'none' || hasTableFilter || groupBy !== 'none';
    }, [sortMode, tableFilters, groupBy]);

    const fetchPaged = async (page = 1, pageSize = 20) => {
        try {
            setLoading(true);
            const values = form.getFieldsValue();
            const params = buildParams(values, 1, API_SAFE_LIMIT);
            const res = await getUsageSessions(params);
            const list = res.data || [];

            setServerData(list);

            const safeTotal = Math.max(res.total || 0, list.length);
            setPagination((p) => ({ ...p, current: page, pageSize, total: safeTotal }));

            if (list.length >= API_SAFE_LIMIT) {
                message.warning(
                    isEn
                        ? `Data may be truncated (limit=${API_SAFE_LIMIT}).`
                        : `Dữ liệu có thể bị cắt (limit=${API_SAFE_LIMIT}).`,
                );
            }
        } catch (err) {
            console.error(err);
            message.error(
                t.messages?.loadError ||
                    (!isEn ? 'Không tải được danh sách phiên sử dụng' : 'Failed to load usage sessions'),
            );
        } finally {
            setLoading(false);
        }
    };

    const fetchAll = async () => {
        try {
            setLoading(true);
            const values = form.getFieldsValue();
            const params = buildParams(values, 1, API_SAFE_LIMIT);
            const res = await getUsageSessions(params);
            const list = res.data || [];

            setFullData(list);
            const safeTotal = Math.max(res.total || 0, list.length);
            setPagination((p) => ({ ...p, total: safeTotal }));
        } catch (err) {
            console.error(err);
            message.error(
                t.messages?.loadError ||
                    (!isEn ? 'Không tải được danh sách phiên sử dụng' : 'Failed to load usage sessions'),
            );
        } finally {
            setLoading(false);
        }
    };

    // initial load
    useEffect(() => {
        fetchPaged(1, pagination.pageSize);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // when needFullData changes -> ensure full data
    useEffect(() => {
        if (!needFullData) return;
        setPagination((p) => ({ ...p, current: 1 }));
        fetchAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [needFullData]);

    return {
        // data
        serverData,
        fullData,
        // ui state
        loading,
        pagination,
        sortMode,
        setSortMode,
        tableFilters,
        setTableFilters,
        groupBy,
        setGroupBy,
        needFullData,
        // actions
        fetchPaged,
        fetchAll,
        setPagination,
    };
}
