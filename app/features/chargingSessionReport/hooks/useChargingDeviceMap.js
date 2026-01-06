import useSWR from 'swr';
import { useMemo, useCallback, useEffect } from 'react';
import { getAuthToken } from '../utils';

// ✅ bump version để bust cache cũ
const MAP_CACHE_KEY = 'deviceMap:charging:v2';
const OLD_KEYS = ['deviceMap:v1']; // ✅ xoá key cũ nếu còn
const MAP_CACHE_TTL_MS = 2 * 60 * 1000; // ✅ 2 phút (tuỳ chỉnh)

function reviveMapsWithTTL(raw) {
    try {
        const obj = JSON.parse(raw);
        if (!obj) return undefined;

        const ts = obj?.ts;
        if (!ts || Date.now() - ts > MAP_CACHE_TTL_MS) return undefined;

        const imeiToPlate = new Map(obj?.imeiToPlate || []);
        const plateToImeis = new Map(obj?.plateToImeis || []);
        return { imeiToPlate, plateToImeis };
    } catch {
        return undefined;
    }
}

function serializeMapsWithTTL({ imeiToPlate, plateToImeis }) {
    return {
        ts: Date.now(),
        imeiToPlate: Array.from((imeiToPlate || new Map()).entries()),
        plateToImeis: Array.from((plateToImeis || new Map()).entries()),
    };
}

export function useChargingDeviceMap({ buildImeiToLicensePlateMap }) {
    // ✅ xoá cache version cũ 1 lần khi mount
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            OLD_KEYS.forEach((k) => localStorage.removeItem(k));
        } catch {}
    }, []);

    // ✅ đọc cache localStorage (nếu còn hạn)
    const fallback = useMemo(() => {
        if (typeof window === 'undefined') return undefined;
        try {
            const raw = localStorage.getItem(MAP_CACHE_KEY);
            if (!raw) return undefined;
            return reviveMapsWithTTL(raw);
        } catch {
            return undefined;
        }
    }, []);

    const fetcher = async () => {
        const token = getAuthToken();
        if (!token) return { imeiToPlate: new Map(), plateToImeis: new Map() };

        const res = await buildImeiToLicensePlateMap(token);
        const imeiToPlate = res?.imeiToPlate || new Map();
        const plateToImeis = res?.plateToImeis || new Map();

        if (typeof window !== 'undefined') {
            localStorage.setItem(MAP_CACHE_KEY, JSON.stringify(serializeMapsWithTTL({ imeiToPlate, plateToImeis })));
        }

        return { imeiToPlate, plateToImeis };
    };

    const swr = useSWR('chargingDeviceMap', fetcher, {
        fallbackData: fallback,
        revalidateOnMount: true, // ✅ F5 vào vẫn fetch lại
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        dedupingInterval: 0, // ✅ tránh kẹt 1h
        shouldRetryOnError: false,
    });

    const refreshDeviceMap = useCallback(() => {
        // ✅ ép fetch map mới ngay (update localStorage)
        return swr.mutate(undefined, { revalidate: true });
    }, [swr]);

    return {
        imeiToPlate: swr.data?.imeiToPlate || new Map(),
        plateToImeis: swr.data?.plateToImeis || new Map(),
        loadingDeviceMap: swr.isLoading || swr.isValidating,
        refreshDeviceMap, // ✅ NEW
    };
}
