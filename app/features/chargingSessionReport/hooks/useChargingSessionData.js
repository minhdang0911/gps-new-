// features/chargingSessionReport/hooks/useChargingSessionData.js
import { useEffect, useMemo, useState, useCallback } from 'react';
import useSWR from 'swr';
import { message } from 'antd';
import { API_SAFE_LIMIT } from '../constants';
import { buildPayload } from '../utils';

function stableStringify(obj) {
    if (!obj) return '';
    const allKeys = [];
    JSON.stringify(obj, (k, v) => {
        allKeys.push(k);
        return v;
    });
    allKeys.sort();
    return JSON.stringify(obj, allKeys);
}
function makeKey(prefix, payload) {
    return payload ? [prefix, stableStringify(payload)] : null;
}

export function useChargingSessionData({
    form,
    getChargingSessions,
    isEn,
    t,
    imeiToPlate,
    plateToImeis,
    loadingDeviceMap,
    attachLicensePlate,
}) {
    const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
    const [sortMode, setSortMode] = useState('none'); // none | newest | oldest
    const needFullData = useMemo(() => sortMode !== 'none', [sortMode]);

    // payload state quyết định SWR fetch
    const [pagedPayload, setPagedPayload] = useState(null);
    const [allPayload, setAllPayload] = useState(null);

    const fetcher = useCallback(
        async ([, payloadJson]) => {
            const payload = JSON.parse(payloadJson);
            return getChargingSessions(payload);
        },
        [getChargingSessions],
    );

    // cache-first: không auto revalidate khi quay lại tab/route
    const swrOpt = useMemo(
        () => ({
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
            // ✅ để TRUE/undefined để lần đầu có key thì fetch (đừng set false)
            // revalidateOnMount: false,
            revalidateIfStale: false,
            keepPreviousData: true,
            dedupingInterval: 5 * 60 * 1000,
            shouldRetryOnError: false,
        }),
        [],
    );

    const pagedKey = useMemo(() => {
        if (loadingDeviceMap) return null;
        if (needFullData) return null;
        return makeKey('chargingSessions:paged', pagedPayload);
    }, [loadingDeviceMap, needFullData, pagedPayload]);

    const allKey = useMemo(() => {
        if (loadingDeviceMap) return null;
        if (!needFullData) return null;
        return makeKey('chargingSessions:all', allPayload);
    }, [loadingDeviceMap, needFullData, allPayload]);

    const swrPaged = useSWR(pagedKey, fetcher, swrOpt);
    const swrAll = useSWR(allKey, fetcher, swrOpt);

    const loading = loadingDeviceMap
        ? true
        : needFullData
        ? swrAll.isLoading || swrAll.isValidating
        : swrPaged.isLoading || swrPaged.isValidating;

    // raw list từ API
    const rawServer = useMemo(() => (swrPaged.data?.data ? swrPaged.data.data : []), [swrPaged.data]);
    const rawFull = useMemo(() => (swrAll.data?.data ? swrAll.data.data : []), [swrAll.data]);

    // enrich theo imeiToPlate (map đổi => chỉ recompute, không gọi API)
    const attachPlate = useCallback((list) => attachLicensePlate(list, imeiToPlate), [attachLicensePlate, imeiToPlate]);

    const serverData = useMemo(() => attachPlate(rawServer), [rawServer, attachPlate]);
    const fullData = useMemo(() => attachPlate(rawFull), [rawFull, attachPlate]);

    // actions giữ nguyên interface
    const fetchPaged = useCallback(
        (page = 1, pageSize = pagination.pageSize || 10) => {
            try {
                const values = form.getFieldsValue();
                const payload = buildPayload({
                    values,
                    page: 1, // giữ đúng logic cũ: server luôn lấy 1 lần limit lớn
                    limit: API_SAFE_LIMIT,
                    plateToImeis,
                });

                setPagination((p) => ({ ...p, current: page, pageSize }));
                setPagedPayload(payload); // key đổi => SWR fetch 1 lần
            } catch (err) {
                console.error('Lỗi lấy charging session: ', err);
                message.error(
                    t?.messages?.loadError ||
                        (isEn ? 'Failed to load charging sessions' : 'Không tải được danh sách phiên sạc'),
                );
            }
        },
        [form, pagination.pageSize, isEn, t, plateToImeis],
    );

    const fetchAll = useCallback(() => {
        try {
            const values = form.getFieldsValue();
            const payload = buildPayload({
                values,
                page: 1,
                limit: 100000,
                plateToImeis,
            });

            setPagination((p) => ({ ...p, current: 1 }));
            setAllPayload(payload);
        } catch (err) {
            console.error('Lỗi lấy charging session (full): ', err);
            message.error(
                t?.messages?.loadError ||
                    (isEn ? 'Failed to load charging sessions' : 'Không tải được danh sách phiên sạc'),
            );
        }
    }, [form, isEn, t, plateToImeis]);

    // initial fetch once maps ready (giống logic cũ)
    useEffect(() => {
        if (loadingDeviceMap) return;

        // set payload lần đầu để SWR tự fetch
        const values = form.getFieldsValue();
        if (needFullData) {
            const payload = buildPayload({ values, page: 1, limit: 100000, plateToImeis });
            setAllPayload(payload);
        } else {
            const payload = buildPayload({ values, page: 1, limit: API_SAFE_LIMIT, plateToImeis });
            setPagedPayload(payload);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadingDeviceMap]);

    // khi sortMode toggles -> switch mode (giống logic cũ, nhưng chỉ set payload)
    useEffect(() => {
        if (loadingDeviceMap) return;

        setPagination((p) => ({ ...p, current: 1 }));

        const values = form.getFieldsValue();
        if (needFullData) {
            const payload = buildPayload({ values, page: 1, limit: 100000, plateToImeis });
            setAllPayload(payload);
        } else {
            const payload = buildPayload({ values, page: 1, limit: API_SAFE_LIMIT, plateToImeis });
            setPagedPayload(payload);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [needFullData]);

    // update total + warning truncation
    useEffect(() => {
        if (loadingDeviceMap) return;

        if (!needFullData) {
            const safeTotal = Math.max(swrPaged.data?.total || 0, serverData.length);
            setPagination((p) => ({ ...p, total: safeTotal }));

            if (serverData.length >= API_SAFE_LIMIT) {
                message.warning(
                    isEn
                        ? `Data may be truncated (limit=${API_SAFE_LIMIT}).`
                        : `Dữ liệu có thể bị cắt (limit=${API_SAFE_LIMIT}).`,
                );
            }
            return;
        }

        setPagination((p) => ({ ...p, total: fullData.length }));
    }, [loadingDeviceMap, needFullData, serverData, fullData, swrPaged.data, isEn]);

    // handle error
    useEffect(() => {
        const err = needFullData ? swrAll.error : swrPaged.error;
        if (!err) return;

        console.error(err);
        message.error(
            t?.messages?.loadError ||
                (isEn ? 'Failed to load charging sessions' : 'Không tải được danh sách phiên sạc'),
        );
    }, [needFullData, swrAll.error, swrPaged.error, isEn, t]);

    const mutate = useCallback(() => {
        if (needFullData) return swrAll.mutate();
        return swrPaged.mutate();
    }, [needFullData, swrAll, swrPaged]);

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

        mutate,
    };
}
