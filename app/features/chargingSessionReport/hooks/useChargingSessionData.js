import { useEffect, useMemo, useState } from 'react';
import { message } from 'antd';
import { API_SAFE_LIMIT } from '../constants';
import { buildPayload } from '../utils';

export function useChargingSessionData({
    form,
    getChargingSessions,
    isEn,
    t,
    imeiToPlate,
    plateToImeis,
    loadingDeviceMap,
    attachLicensePlate, // existing util
}) {
    const [serverData, setServerData] = useState([]);
    const [fullData, setFullData] = useState([]);
    const [loading, setLoading] = useState(false);

    const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });

    const [sortMode, setSortMode] = useState('none'); // none | newest | oldest
    const needFullData = useMemo(() => sortMode !== 'none', [sortMode]);

    const attachPlate = (list) => attachLicensePlate(list, imeiToPlate);

    const fetchPaged = async (page = 1, pageSize = 10) => {
        try {
            setLoading(true);
            const values = form.getFieldsValue();

            const payload = buildPayload({
                values,
                page: 1,
                limit: API_SAFE_LIMIT,
                plateToImeis,
            });

            const res = await getChargingSessions(payload);
            const list = res.data || [];
            const enriched = attachPlate(list);

            setServerData(enriched);

            const safeTotal = Math.max(res.total || 0, enriched.length);
            setPagination((p) => ({ ...p, current: page, pageSize, total: safeTotal }));

            if (enriched.length >= API_SAFE_LIMIT) {
                message.warning(
                    isEn
                        ? `Data may be truncated (limit=${API_SAFE_LIMIT}).`
                        : `Dữ liệu có thể bị cắt (limit=${API_SAFE_LIMIT}).`,
                );
            }
        } catch (err) {
            console.error('Lỗi lấy charging session: ', err);
            message.error(
                t?.messages?.loadError ||
                    (isEn ? 'Failed to load charging sessions' : 'Không tải được danh sách phiên sạc'),
            );
        } finally {
            setLoading(false);
        }
    };

    const fetchAll = async () => {
        try {
            setLoading(true);
            const values = form.getFieldsValue();

            const payload = buildPayload({
                values,
                page: 1,
                limit: 100000,
                plateToImeis,
            });

            const res = await getChargingSessions(payload);
            const list = res.data || [];
            const enriched = attachPlate(list);

            setFullData(enriched);
            setPagination((p) => ({ ...p, total: enriched.length }));
        } catch (err) {
            console.error('Lỗi lấy charging session (full): ', err);
            message.error(
                t?.messages?.loadError ||
                    (isEn ? 'Failed to load charging sessions' : 'Không tải được danh sách phiên sạc'),
            );
        } finally {
            setLoading(false);
        }
    };

    // initial fetch once maps ready
    useEffect(() => {
        if (loadingDeviceMap) return;
        if (needFullData) fetchAll();
        else fetchPaged(1, pagination.pageSize);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadingDeviceMap, imeiToPlate, plateToImeis]);

    // when sortMode toggles -> switch mode
    useEffect(() => {
        setPagination((p) => ({ ...p, current: 1 }));
        if (loadingDeviceMap) return;
        if (needFullData) fetchAll();
        else fetchPaged(1, pagination.pageSize);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [needFullData]);

    return {
        serverData,
        fullData,
        loading,

        pagination,
        setPagination,

        sortMode,
        setSortMode,

        needFullData,

        fetchPaged,
        fetchAll,
    };
}
