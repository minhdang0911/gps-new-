import { useEffect, useState } from 'react';
import { message } from 'antd';
import { API_SAFE_LIMIT } from '../constants';
import { buildParams } from '../utils';

export function useTripSessionData({
    form,
    getTripSessions,
    isEn,
    t,
    imeiToPlate,
    plateToImeis,
    loadingDeviceMap,
    attachLicensePlate, // existing util
}) {
    const [serverData, setServerData] = useState([]);
    const [loading, setLoading] = useState(false);

    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 10,
        total: 0,
    });

    const [sortMode, setSortMode] = useState('none'); // none | newest | oldest

    const fetchBase = async ({ resetPage = false } = {}) => {
        try {
            setLoading(true);
            const values = form.getFieldsValue();

            // ✅ BE bug workaround: always fetch page=1 + big limit
            const params = buildParams({
                values,
                page: 1,
                limit: API_SAFE_LIMIT,
                plateToImeis,
            });

            const res = await getTripSessions(params);
            const list = res.data || [];
            const enriched = attachLicensePlate(list, imeiToPlate);

            setServerData(enriched);

            const safeTotal = Math.max(res.total || 0, enriched.length);
            setPagination((p) => ({
                ...p,
                current: resetPage ? 1 : p.current,
                total: safeTotal,
            }));

            if (enriched.length >= API_SAFE_LIMIT) {
                message.warning(
                    isEn
                        ? `Data may be truncated (limit=${API_SAFE_LIMIT}). Consider increasing API_SAFE_LIMIT.`
                        : `Dữ liệu có thể bị cắt (limit=${API_SAFE_LIMIT}). Cân nhắc tăng API_SAFE_LIMIT.`,
                );
            }
        } catch (err) {
            console.error('Lỗi lấy trip session: ', err);
            message.error(t?.messages?.loadError || (isEn ? 'Failed to load data' : 'Không tải được dữ liệu'));
        } finally {
            setLoading(false);
        }
    };

    // fetch when maps ready
    useEffect(() => {
        if (loadingDeviceMap) return;
        fetchBase({ resetPage: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadingDeviceMap, imeiToPlate, plateToImeis]);

    return {
        serverData,
        loading,

        pagination,
        setPagination,

        sortMode,
        setSortMode,

        fetchBase,
    };
}
