// features/tripSessionReport/hooks/useTripSessionData.js
import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { message } from 'antd';
import { API_SAFE_LIMIT } from '../constants';

// ⚠️ nếu bạn đã có util build payload riêng thì import vào đây
// ví dụ: import { buildPayload } from '../utils';
// Mình viết inline để bạn dễ ráp. Nếu dự án bạn đã có buildPayloadTrip thì thay vào.

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

function normalizeTripPayload({ values, plateToImeis, page = 1, limit = API_SAFE_LIMIT }) {
    // ✅ IMPORTANT: tránh bỏ dayjs/moment object vào payload
    const timeRange = values?.timeRange;
    const startTime = timeRange?.[0] ? timeRange[0].toISOString?.() || String(timeRange[0]) : undefined;
    const endTime = timeRange?.[1] ? timeRange[1].toISOString?.() || String(timeRange[1]) : undefined;

    // license plate -> imeis
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

        // nếu backend bạn filter theo license plate thì gửi plate,
        // còn nếu backend filter imei thì map plate -> imeis:
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
    const [serverDataRaw, setServerDataRaw] = useState([]); // giữ raw nếu cần
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

    // ✅ cache-first: không auto gọi lại khi focus/reconnect
    // ⚠️ KHÔNG set revalidateOnMount:false, vì payload thường set bằng useEffect => sẽ làm “không fetch lần đầu”
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

    const key = useMemo(() => {
        if (loadingDeviceMap) return null;
        return makeKey('tripSessions:base', basePayload);
    }, [loadingDeviceMap, basePayload]);

    const swr = useSWR(key, fetcher, swrOpt);

    const loading = loadingDeviceMap ? true : swr.isLoading || swr.isValidating;

    // raw list từ API
    const apiList = useMemo(() => (swr.data?.data ? swr.data.data : []), [swr.data]);

    // attach license plate theo imeiToPlate (map đổi => chỉ enrich lại, KHÔNG gọi API lại)
    const serverData = useMemo(() => {
        const list = apiList || [];
        try {
            return attachLicensePlate ? attachLicensePlate(list, imeiToPlate) : list;
        } catch (e) {
            // attach fail thì vẫn trả list cho khỏi “trắng”
            console.error(e);
            return list;
        }
    }, [apiList, attachLicensePlate, imeiToPlate]);

    // giữ raw nếu bạn cần debug
    useEffect(() => {
        setServerDataRaw(apiList || []);
    }, [apiList]);

    // action cho page gọi (Search/Reset)
    const fetchBase = useCallback(
        ({ resetPage } = {}) => {
            try {
                const values = form.getFieldsValue();
                const next = normalizeTripPayload({
                    values,
                    plateToImeis,
                    page: 1,
                    limit: API_SAFE_LIMIT,
                });

                if (resetPage) {
                    setPagination((p) => ({ ...p, current: 1 }));
                }
                setBasePayload(next); // key đổi => SWR fetch 1 lần
            } catch (err) {
                console.error(err);
                message.error(
                    t?.messages?.loadError ||
                        (!isEn ? 'Không tải được danh sách hành trình' : 'Failed to load trip sessions'),
                );
            }
        },
        [form, plateToImeis, isEn, t],
    );

    // initial fetch khi map ready (giống logic các page khác)
    useEffect(() => {
        if (loadingDeviceMap) return;
        fetchBase({ resetPage: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadingDeviceMap]);

    // update total (tôn trọng total từ BE nếu có)
    useEffect(() => {
        if (loadingDeviceMap) return;
        const list = serverData || [];
        const safeTotal = Math.max(swr.data?.total || 0, list.length);
        setPagination((p) => ({ ...p, total: safeTotal }));

        if (list.length >= API_SAFE_LIMIT) {
            message.warning(
                isEn
                    ? `Data may be truncated (limit=${API_SAFE_LIMIT}).`
                    : `Dữ liệu có thể bị cắt (limit=${API_SAFE_LIMIT}).`,
            );
        }
    }, [loadingDeviceMap, serverData, swr.data, isEn]);

    // handle error
    useEffect(() => {
        if (!swr.error) return;
        console.error(swr.error);
        message.error(
            t?.messages?.loadError || (!isEn ? 'Không tải được danh sách hành trình' : 'Failed to load trip sessions'),
        );
    }, [swr.error, isEn, t]);

    // optional reload
    const mutate = useCallback(() => swr.mutate(), [swr]);

    return {
        // data
        serverData, // ✅ page đang dùng cái này để sort + paginate FE
        serverDataRaw, // optional

        // ui state
        loading,
        pagination,
        setPagination,

        sortMode,
        setSortMode,

        // actions
        fetchBase,
        mutate,
    };
}
