// features/tripSessionReport/hooks/useTripSessionData.js
import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { message } from 'antd';
import { API_SAFE_LIMIT } from '../constants';

function stableStringify(obj) {
    if (!obj) return '';
    const keys = [];
    JSON.stringify(obj, (k, v) => {
        keys.push(k);
        return v;
    });
    keys.sort();
    return JSON.stringify(obj, keys);
}

function makeKey(prefix, payload) {
    return payload ? [prefix, stableStringify(payload)] : null;
}

function pickList(res) {
    // tuỳ API, bạn để fallback an toàn
    return res?.devices || res?.data || res?.items || [];
}

function normalizeTripPayload({ values, plateToImeis, page = 1, limit = API_SAFE_LIMIT }) {
    // tránh dayjs/moment object trong payload
    const timeRange = values?.timeRange;
    const startTime = timeRange?.[0] ? timeRange[0].toISOString?.() || String(timeRange[0]) : undefined;
    const endTime = timeRange?.[1] ? timeRange[1].toISOString?.() || String(timeRange[1]) : undefined;

    const plate = values?.license_plate?.trim?.();
    const plateImeis = plate ? plateToImeis?.[plate] : null;

    return {
        page,
        limit,
        tripCode: values?.tripCode?.trim?.() || undefined,
        imei: values?.imei?.trim?.() || undefined,
        soh: values?.soh || undefined,
        startTime,
        endTime,

        // tuỳ BE bạn dùng cái nào:
        license_plate: plate || undefined,
        imeis: plateImeis && plateImeis.length ? plateImeis : undefined,
    };
}

export function useTripSessionData({
    form,
    getTripSessions,
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

    // payload quyết định SWR fetch
    const [basePayload, setBasePayload] = useState(null);

    const fetcher = useCallback(
        async ([, payloadJson]) => {
            const payload = JSON.parse(payloadJson);
            return getTripSessions(payload);
        },
        [getTripSessions],
    );

    const swrOpt = useMemo(
        () => ({
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
            revalidateIfStale: false,

            keepPreviousData: true,
            dedupingInterval: 5 * 60 * 1000,
            shouldRetryOnError: false,
            // ✅ KHÔNG set revalidateOnMount:false (kẻo cache miss mà không fetch)
        }),
        [],
    );

    const key = useMemo(() => {
        if (loadingDeviceMap) return null;
        return makeKey('tripSessions:base', basePayload);
    }, [loadingDeviceMap, basePayload]);

    const swr = useSWR(key, fetcher, swrOpt);
    const loading = loadingDeviceMap ? true : swr.isLoading || swr.isValidating;

    // ===== parse list =====
    const apiList = useMemo(() => pickList(swr.data), [swr.data]);

    // attach license plate theo imeiToPlate
    const serverData = useMemo(() => {
        const list = apiList || [];
        try {
            return attachLicensePlate ? attachLicensePlate(list, imeiToPlate) : list;
        } catch (e) {
            console.error(e);
            return list;
        }
    }, [apiList, attachLicensePlate, imeiToPlate]);

    const toastLoadError = useCallback(() => {
        // message.error(
        //     t?.messages?.loadError || (!isEn ? 'Không tải được danh sách hành trình' : 'Failed to load trip sessions'),
        // );
    }, [isEn, t]);

    // ✅ Force fetch khi user bấm Search/Reset (payload y hệt vẫn gọi)
    const forceFetch = useCallback(
        async (prefix, payload) => {
            const k = makeKey(prefix, payload);
            await globalMutate(k, fetcher, { revalidate: true });
        },
        [globalMutate, fetcher],
    );

    // ===== INITIAL PAYLOAD (cache-first) =====
    // - có cache: show cache, không auto gọi lại
    // - cache miss (F5/lần đầu): SWR fetch 1 lần
    useEffect(() => {
        if (loadingDeviceMap) return;

        const values = form.getFieldsValue();
        const payload = normalizeTripPayload({
            values,
            plateToImeis,
            page: 1,
            limit: API_SAFE_LIMIT,
        });

        setBasePayload(payload);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadingDeviceMap]);

    // ===== actions =====
    const fetchBase = useCallback(
        async ({ resetPage } = {}, { force = false } = {}) => {
            try {
                const values = form.getFieldsValue();
                const payload = normalizeTripPayload({
                    values,
                    plateToImeis,
                    page: 1,
                    limit: API_SAFE_LIMIT,
                });

                if (resetPage) {
                    setPagination((p) => ({ ...p, current: 1 }));
                }

                setBasePayload(payload);

                if (force) await forceFetch('tripSessions:base', payload);
            } catch (err) {
                console.error(err);
                toastLoadError();
            }
        },
        [form, plateToImeis, forceFetch, toastLoadError],
    );

    // update total (+ warning truncation)
    useEffect(() => {
        if (loadingDeviceMap) return;

        const list = serverData || [];
        const safeTotal = Math.max(swr.data?.total || 0, list.length);
        setPagination((p) => ({ ...p, total: safeTotal }));

        if (list.length >= API_SAFE_LIMIT) {
            // message.warning(
            //     isEn
            //         ? `Data may be truncated (limit=${API_SAFE_LIMIT}).`
            //         : `Dữ liệu có thể bị cắt (limit=${API_SAFE_LIMIT}).`,
            // );
        }
    }, [loadingDeviceMap, serverData, swr.data, isEn]);

    // handle error
    useEffect(() => {
        if (!swr.error) return;
        console.error(swr.error);
        toastLoadError();
    }, [swr.error, toastLoadError]);

    const mutate = useCallback(() => swr.mutate(), [swr]);

    return {
        serverData,

        loading,
        pagination,
        setPagination,

        sortMode,
        setSortMode,

        fetchBase, // ✅ signature mới: fetchBase({resetPage:true},{force:true})
        mutate,
    };
}
