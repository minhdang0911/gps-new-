// features/chargingSessionReport/hooks/useChargingSessionData.js
import { useEffect, useMemo, useState, useCallback } from 'react';
import useSWR, { useSWRConfig } from 'swr';
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

function pickList(res) {
    // backend của bạn trả { devices: [...] }
    return res?.devices || res?.data || res?.items || [];
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
    const { mutate: globalMutate } = useSWRConfig();

    const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
    const [sortMode, setSortMode] = useState('none'); // none | newest | oldest
    const needFullData = useMemo(() => sortMode !== 'none', [sortMode]);

    const [pagedPayload, setPagedPayload] = useState(null);
    const [allPayload, setAllPayload] = useState(null);

    const fetcher = useCallback(
        async ([, payloadJson]) => {
            const payload = JSON.parse(payloadJson);
            return getChargingSessions(payload);
        },
        [getChargingSessions],
    );

    const swrOpt = useMemo(
        () => ({
            // ✅ cache-first + không tự refetch khi quay lại tab/route
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
            revalidateIfStale: false,

            keepPreviousData: true,
            dedupingInterval: 5 * 60 * 1000,
            shouldRetryOnError: false,

            // ✅ QUAN TRỌNG: KHÔNG set revalidateOnMount:false
            // vì nó sẽ chặn luôn fetch lần đầu khi cache miss.
        }),
        [],
    );

    // ====== SWR keys ======
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

    // ====== parse list ======
    const rawServer = useMemo(() => pickList(swrPaged.data), [swrPaged.data]);
    const rawFull = useMemo(() => pickList(swrAll.data), [swrAll.data]);

    // enrich plate
    const attachPlate = useCallback(
        (list) => {
            try {
                return attachLicensePlate ? attachLicensePlate(list, imeiToPlate) : list;
            } catch (e) {
                console.error(e);
                return list;
            }
        },
        [attachLicensePlate, imeiToPlate],
    );

    const serverData = useMemo(() => attachPlate(rawServer), [rawServer, attachPlate]);
    const fullData = useMemo(() => attachPlate(rawFull), [rawFull, attachPlate]);

    const toastLoadError = useCallback(() => {
        // message.error(
        //     t?.messages?.loadError ||
        //         (isEn ? 'Failed to load charging sessions' : 'Không tải được danh sách phiên sạc'),
        // );
    }, [isEn, t]);

    // ✅ Force fetch khi user bấm Search/Reset (kể cả payload y hệt)
    const forceFetch = useCallback(
        async (prefix, payload) => {
            const key = makeKey(prefix, payload);
            await globalMutate(key, fetcher, { revalidate: true });
        },
        [globalMutate, fetcher],
    );

    // ====== INITIAL PAYLOAD (cache-first) ======
    // - Có cache: show cache, KHÔNG gọi lại vì revalidateOnFocus/reconnect/stale đều false
    // - Cache miss (F5/lần đầu): SWR sẽ fetch 1 lần (default behavior)
    useEffect(() => {
        if (loadingDeviceMap) return;

        const values = form.getFieldsValue();

        if (needFullData) {
            const payload = buildPayload({ values, page: 1, limit: 100000, plateToImeis });
            setAllPayload(payload);
        } else {
            const payload = buildPayload({ values, page: 1, limit: API_SAFE_LIMIT, plateToImeis });
            setPagedPayload(payload);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadingDeviceMap, needFullData]);

    // ====== actions ======
    const fetchPaged = useCallback(
        async (page = 1, pageSize = pagination.pageSize || 10, { force = false } = {}) => {
            try {
                const values = form.getFieldsValue();
                const payload = buildPayload({
                    values,
                    page: 1,
                    limit: API_SAFE_LIMIT,
                    plateToImeis,
                });

                setPagination((p) => ({ ...p, current: page, pageSize }));
                setPagedPayload(payload);

                if (force) await forceFetch('chargingSessions:paged', payload);
            } catch (err) {
                console.error('Lỗi lấy charging session: ', err);
                toastLoadError();
            }
        },
        [form, pagination.pageSize, plateToImeis, forceFetch, toastLoadError],
    );

    const fetchAll = useCallback(
        async ({ force = false } = {}) => {
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

                if (force) await forceFetch('chargingSessions:all', payload);
            } catch (err) {
                console.error('Lỗi lấy charging session (full): ', err);
                toastLoadError();
            }
        },
        [form, plateToImeis, forceFetch, toastLoadError],
    );

    // total + warning truncation
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

    // error
    useEffect(() => {
        const err = needFullData ? swrAll.error : swrPaged.error;
        if (!err) return;
        console.error(err);
        toastLoadError();
    }, [needFullData, swrAll.error, swrPaged.error, toastLoadError]);

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
