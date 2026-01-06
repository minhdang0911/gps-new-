import useSWR from 'swr';
import { useMemo, useCallback, useEffect } from 'react';
import { getAuthToken } from '../utils'; // giữ đúng path bạn

// ✅ bump version để bust cache cũ
const MAP_CACHE_KEY = 'lastCruiseDeviceMap:v2';
const OLD_KEYS = ['lastCruiseDeviceMap:v1']; // ✅ xoá key cũ nếu còn
const MAP_CACHE_TTL_MS = 2 * 60 * 1000; // ✅ 2 phút (tuỳ chỉnh)

const normalizePlate = (s) =>
    (s || '').toString().trim().toUpperCase().replace(/\s+/g, '').replace(/[._]/g, '-').replace(/--+/g, '-');

function reviveMapWithTTL(raw) {
    try {
        const obj = JSON.parse(raw);
        if (!obj) return undefined;

        const ts = obj?.ts;
        if (!ts || Date.now() - ts > MAP_CACHE_TTL_MS) return undefined;

        return new Map(obj?.imeiToPlate || []);
    } catch {
        return undefined;
    }
}

function serializeMapWithTTL(map) {
    return { ts: Date.now(), imeiToPlate: Array.from((map || new Map()).entries()) };
}

export function useLastCruiseDeviceMap({ buildImeiToLicensePlateMap }) {
    // ✅ xoá cache version cũ 1 lần khi mount
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            OLD_KEYS.forEach((k) => localStorage.removeItem(k));
        } catch {}
    }, []);

    // ✅ đọc cache localStorage (nếu còn hạn)
    const fallbackMap = useMemo(() => {
        if (typeof window === 'undefined') return undefined;
        try {
            const raw = localStorage.getItem(MAP_CACHE_KEY);
            if (!raw) return undefined;
            return reviveMapWithTTL(raw);
        } catch {
            return undefined;
        }
    }, []);

    const fetcher = async () => {
        const token = getAuthToken();
        if (!token) return new Map();

        const res = await buildImeiToLicensePlateMap(token);
        const map = res?.imeiToPlate ?? res ?? new Map();
        console.log('DEVICE MAP FETCH');
        console.log('plate for 860056082635831 =', map.get('860056082635831'));

        if (typeof window !== 'undefined') {
            localStorage.setItem(MAP_CACHE_KEY, JSON.stringify(serializeMapWithTTL(map)));
        }
        return map;
    };

    const swr = useSWR('lastCruiseDeviceMap', fetcher, {
        fallbackData: fallbackMap,
        revalidateOnMount: true, // ✅ F5 vào luôn fetch lại
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        dedupingInterval: 0, // ✅ không kẹt 1h
        shouldRetryOnError: false,
    });

    const imeiToPlate = swr.data || new Map();

    const plateToImeis = useMemo(() => {
        const m = new Map();
        for (const [imei, plate] of imeiToPlate instanceof Map ? imeiToPlate.entries() : []) {
            if (!plate) continue;
            const key = normalizePlate(plate);
            const arr = m.get(key) || [];
            arr.push(String(imei));
            m.set(key, arr);
        }
        return m;
    }, [imeiToPlate]);

    const refreshDeviceMap = useCallback(() => {
        // ✅ ép refetch map mới + update localStorage
        return swr.mutate(undefined, { revalidate: true });
    }, [swr]);

    return {
        imeiToPlate,
        plateToImeis,
        loadingDeviceMap: swr.isLoading || swr.isValidating,
        refreshDeviceMap,
    };
}
