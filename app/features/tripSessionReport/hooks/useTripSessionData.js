import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { message } from 'antd';
import { API_SAFE_LIMIT } from '../constants';
import { useAuthStore } from '../../../stores/authStore'; // chỉnh path
import { makeUserKey } from '../../_shared/swrKey'; // chỉnh path

// normalizeTripPayload giữ nguyên như bạn đang có

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
    const userId = useAuthStore((s) => s.user?._id) || 'guest';
    const { mutate: globalMutate } = useSWRConfig();

    const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
    const [sortMode, setSortMode] = useState('none');
    const [basePayload, setBasePayload] = useState(null);

    const fetcher = useCallback(
        async ([, , payloadJson]) => {
            const payload = JSON.parse(payloadJson);
            return getTripSessions(payload);
        },
        [getTripSessions],
    );

    const key = useMemo(() => {
        if (loadingDeviceMap) return null;
        return makeUserKey(userId, 'tripSessions:base', basePayload);
    }, [loadingDeviceMap, basePayload, userId]);

    const swr = useSWR(key, fetcher);

    const loading = loadingDeviceMap ? true : swr.isLoading || swr.isValidating;

    const apiList = useMemo(() => (swr.data?.data ? swr.data.data : []), [swr.data]);

    const serverData = useMemo(() => {
        try {
            return attachLicensePlate ? attachLicensePlate(apiList, imeiToPlate) : apiList;
        } catch (e) {
            console.error(e);
            return apiList;
        }
    }, [apiList, attachLicensePlate, imeiToPlate]);

    const fetchBase = useCallback(
        async ({ resetPage } = {}) => {
            try {
                const values = form.getFieldsValue();
                const next = normalizeTripPayload({ values, plateToImeis, page: 1, limit: API_SAFE_LIMIT });

                if (resetPage) setPagination((p) => ({ ...p, current: 1 }));
                setBasePayload(next);

                // force call khi Search/Reset
                const forceKey = makeUserKey(userId, 'tripSessions:base', next);
                await globalMutate(forceKey, fetcher, { revalidate: true });
            } catch (err) {
                console.error(err);
            }
        },
        [form, plateToImeis, globalMutate, fetcher, isEn, t, userId],
    );

    useEffect(() => {
        if (loadingDeviceMap) return;
        // chỉ set payload để đọc cache; nếu muốn auto fetch lần đầu thì gọi fetchBase({resetPage:true})
        fetchBase({ resetPage: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadingDeviceMap, userId]);

    useEffect(() => {
        if (loadingDeviceMap) return;
        const safeTotal = Math.max(swr.data?.total || 0, serverData.length);
        setPagination((p) => ({ ...p, total: safeTotal }));
    }, [loadingDeviceMap, swr.data, serverData.length]);

    useEffect(() => {
        if (!swr.error) return;
        console.error(swr.error);
    }, [swr.error, isEn, t]);

    return {
        serverData,
        loading,
        pagination,
        setPagination,
        sortMode,
        setSortMode,
        fetchBase,
        mutate: swr.mutate,
    };
}
