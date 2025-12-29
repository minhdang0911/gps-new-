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
    return res?.devices || res?.data || res?.items || [];
}

function normalizeTripPayload({ values, plateToImeis, page = 1, limit = API_SAFE_LIMIT }) {
    const timeRange = values?.timeRange;
    const startTime = timeRange?.[0] ? timeRange[0].toISOString?.() || String(timeRange[0]) : undefined;
    const endTime = timeRange?.[1] ? timeRange[1].toISOString?.() || String(timeRange[1]) : undefined;

    const plate = values?.license_plate?.trim?.();

    return {
        page,
        limit,
        tripCode: values?.tripCode?.trim?.() || undefined,
        soh: values?.soh || undefined,
        startTime,
        endTime,
        license_plate: plate || undefined,
        // imeis: plate ? (plateToImeis?.get?.(plate) || undefined) : undefined,
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
    const [sortMode, setSortMode] = useState('none');
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
        }),
        [],
    );

    const key = useMemo(() => makeKey('tripSessions:base', basePayload), [basePayload]);

    const cleanFloat = (value, digits = 3) => {
        const n = Number(value);
        if (!Number.isFinite(n)) return value;
        const f = 10 ** digits;
        return Math.round((n + Number.EPSILON) * f) / f;
    };

    const cleanTripRow = (r) => ({
        ...r,
        // distance
        distanceKm: cleanFloat(r?.distanceKm, 3),
        mileageToday: cleanFloat(r?.mileageToday, 3),
        distance: cleanFloat(r?.distance, 3),

        // ✅ power + energy
        consumedKw: cleanFloat(r?.consumedKw, 3),
        consumedKwh: cleanFloat(r?.consumedKwh, 3), // ✅ THÊM DÒNG NÀY

        socEnd: cleanFloat(r?.socEnd, 2),
        soh: cleanFloat(r?.soh, 2),
        endLat: cleanFloat(r?.endLat, 6),
        endLng: cleanFloat(r?.endLng, 6),
        startLat: cleanFloat(r?.startLat, 6),
        startLng: cleanFloat(r?.startLng, 6),
    });

    const swr = useSWR(key, fetcher, swrOpt);
    const loading = swr.isLoading || swr.isValidating;

    const apiList = useMemo(() => {
        const list = pickList(swr.data) || [];
        return list.map(cleanTripRow);
    }, [swr.data]);

    const serverData = useMemo(() => {
        const list = apiList || [];
        try {
            if (!attachLicensePlate) return list;
            if (!imeiToPlate || imeiToPlate.size === 0) return list;
            return attachLicensePlate(list, imeiToPlate);
        } catch (e) {
            console.error(e);
            return list;
        }
    }, [apiList, attachLicensePlate, imeiToPlate]);

    const toastLoadError = useCallback(() => {
        // message.error(...)
    }, [isEn, t]);

    const forceFetch = useCallback(
        async (prefix, payload) => {
            const k = makeKey(prefix, payload);
            await globalMutate(k, fetcher, { revalidate: true });
        },
        [globalMutate, fetcher],
    );

    useEffect(() => {
        const values = form.getFieldsValue();
        const payload = normalizeTripPayload({
            values,
            plateToImeis,
            page: 1,
            limit: API_SAFE_LIMIT,
        });
        setBasePayload(payload);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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

                if (resetPage) setPagination((p) => ({ ...p, current: 1 }));
                setBasePayload(payload);
                if (force) await forceFetch('tripSessions:base', payload);
            } catch (err) {
                console.error(err);
                toastLoadError();
            }
        },
        [form, plateToImeis, forceFetch, toastLoadError],
    );

    useEffect(() => {
        if (loadingDeviceMap) return;
        const list = serverData || [];
        if (list.length >= API_SAFE_LIMIT) {
            // message.warning(...)
        }
    }, [loadingDeviceMap, serverData, isEn]);

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
        fetchBase,
        mutate,
    };
}
