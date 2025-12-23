import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { message } from 'antd';

import { API_SAFE_LIMIT } from '../constants';
import { buildPayload } from '../utils'; // vẫn dùng util hiện có
import { useAuthStore } from '../../../stores/authStore';
import { makeUserKey } from '../../_shared/swrKey';

// ✅ strip các field BE không support (imei/license_plate/imeis)
function stripUnsupportedParams(payload) {
    if (!payload || typeof payload !== 'object') return payload;

    const next = { ...payload };

    // form fields
    delete next.imei;
    delete next.license_plate;

    // mapping fields (nếu util buildPayload có set)
    delete next.imeis;
    delete next.imeiText;
    delete next.plateText;

    return next;
}

export function useChargingSessionData({
    form,
    getChargingSessions,
    isEn,
    t,
    imeiToPlate,
    plateToImeis, // (không dùng trong payload nữa, chỉ để giữ signature)
    loadingDeviceMap,
    attachLicensePlate,
}) {
    const userId = useAuthStore((s) => s.user?._id) || 'guest';
    const { mutate: globalMutate } = useSWRConfig();

    const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
    const [sortMode, setSortMode] = useState('none'); // none | newest | oldest (tuỳ options)
    const needFullData = useMemo(() => sortMode !== 'none', [sortMode]);

    const [pagedPayload, setPagedPayload] = useState(null);
    const [allPayload, setAllPayload] = useState(null);

    const fetcher = useCallback(
        async ([, , payloadJson]) => {
            const payload = JSON.parse(payloadJson);
            return getChargingSessions(payload);
        },
        [getChargingSessions],
    );

    const pagedKey = useMemo(() => {
        if (loadingDeviceMap) return null;
        if (needFullData) return null;
        return makeUserKey(userId, 'chargingSessions:paged', pagedPayload);
    }, [loadingDeviceMap, needFullData, pagedPayload, userId]);

    const allKey = useMemo(() => {
        if (loadingDeviceMap) return null;
        if (!needFullData) return null;
        return makeUserKey(userId, 'chargingSessions:all', allPayload);
    }, [loadingDeviceMap, needFullData, allPayload, userId]);

    const swrPaged = useSWR(pagedKey, fetcher, {
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        revalidateIfStale: false,
        keepPreviousData: true,
        dedupingInterval: 5 * 60 * 1000,
        shouldRetryOnError: false,
    });

    const swrAll = useSWR(allKey, fetcher, {
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        revalidateIfStale: false,
        keepPreviousData: true,
        dedupingInterval: 5 * 60 * 1000,
        shouldRetryOnError: false,
    });

    const loading = loadingDeviceMap
        ? true
        : needFullData
        ? swrAll.isLoading || swrAll.isValidating
        : swrPaged.isLoading || swrPaged.isValidating;

    const rawServer = useMemo(() => (swrPaged.data?.data ? swrPaged.data.data : []), [swrPaged.data]);
    const rawFull = useMemo(() => (swrAll.data?.data ? swrAll.data.data : []), [swrAll.data]);

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
        //   t?.messages?.loadError || (isEn ? 'Failed to load charging sessions' : 'Không tải được danh sách phiên sạc'),
        // );
    }, [isEn, t]);

    const forceFetch = useCallback(
        async (prefix, payload) => {
            const key = makeUserKey(userId, prefix, payload);
            await globalMutate(key, fetcher, { revalidate: true });
        },
        [globalMutate, fetcher, userId],
    );

    const fetchPaged = useCallback(
        async (page = 1, pageSize = pagination.pageSize || 10, { force = false } = {}) => {
            try {
                const values = form.getFieldsValue();

                // ✅ buildPayload vẫn có thể build các field khác mà BE support (chargeCode/soh/timeRange...)
                // ❌ nhưng tuyệt đối strip imei/license_plate/imeis
                const payloadRaw = buildPayload({
                    values,
                    page: 1,
                    limit: API_SAFE_LIMIT,
                    plateToImeis, // giữ cho util nếu cần, nhưng sẽ bị strip ra
                });

                const payload = stripUnsupportedParams(payloadRaw);

                setPagination((p) => ({ ...p, current: page, pageSize }));
                setPagedPayload(payload);

                if (force) await forceFetch('chargingSessions:paged', payload);
            } catch (err) {
                console.error(err);
                toastLoadError();
            }
        },
        [form, pagination.pageSize, plateToImeis, forceFetch, toastLoadError],
    );

    const fetchAll = useCallback(
        async ({ force = false } = {}) => {
            try {
                const values = form.getFieldsValue();

                const payloadRaw = buildPayload({
                    values,
                    page: 1,
                    limit: 100000,
                    plateToImeis,
                });

                const payload = stripUnsupportedParams(payloadRaw);

                setPagination((p) => ({ ...p, current: 1 }));
                setAllPayload(payload);

                if (force) await forceFetch('chargingSessions:all', payload);
            } catch (err) {
                console.error(err);
                toastLoadError();
            }
        },
        [form, plateToImeis, forceFetch, toastLoadError],
    );

    // initial: set payload để “đọc cache nếu có”
    useEffect(() => {
        if (loadingDeviceMap) return;

        const values = form.getFieldsValue();
        if (needFullData) {
            const payload = stripUnsupportedParams(buildPayload({ values, page: 1, limit: 100000, plateToImeis }));
            setAllPayload(payload);
        } else {
            const payload = stripUnsupportedParams(
                buildPayload({ values, page: 1, limit: API_SAFE_LIMIT, plateToImeis }),
            );
            setPagedPayload(payload);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadingDeviceMap, userId]);

    // đổi sortMode => đổi nguồn data
    useEffect(() => {
        if (loadingDeviceMap) return;

        setPagination((p) => ({ ...p, current: 1 }));
        const values = form.getFieldsValue();

        if (needFullData) {
            const payload = stripUnsupportedParams(buildPayload({ values, page: 1, limit: 100000, plateToImeis }));
            setAllPayload(payload);
        } else {
            const payload = stripUnsupportedParams(
                buildPayload({ values, page: 1, limit: API_SAFE_LIMIT, plateToImeis }),
            );
            setPagedPayload(payload);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [needFullData, userId]);

    // total (unfiltered) — page sẽ override theo FE filter
    useEffect(() => {
        if (loadingDeviceMap) return;

        if (!needFullData) {
            const safeTotal = Math.max(swrPaged.data?.total || 0, serverData.length);
            setPagination((p) => ({ ...p, total: safeTotal }));

            if (serverData.length >= API_SAFE_LIMIT) {
                // message.warning(
                //   isEn ? `Data may be truncated (limit=${API_SAFE_LIMIT}).` : `Dữ liệu có thể bị cắt (limit=${API_SAFE_LIMIT}).`,
                // );
            }
            return;
        }

        setPagination((p) => ({ ...p, total: fullData.length }));
    }, [loadingDeviceMap, needFullData, serverData, fullData, swrPaged.data, isEn]);

    useEffect(() => {
        const err = needFullData ? swrAll.error : swrPaged.error;
        if (!err) return;
        console.error(err);
        toastLoadError();
    }, [needFullData, swrAll.error, swrPaged.error, toastLoadError]);

    const mutate = useCallback(
        () => (needFullData ? swrAll.mutate() : swrPaged.mutate()),
        [needFullData, swrAll, swrPaged],
    );

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
