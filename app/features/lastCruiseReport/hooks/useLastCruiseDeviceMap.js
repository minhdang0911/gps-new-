// features/lastCruise/hooks/useLastCruiseDeviceMap.js
import useSWR from 'swr';
import { useMemo } from 'react';
import { getAuthToken } from '../utils'; // giữ đúng path bạn

const MAP_CACHE_KEY = 'lastCruiseDeviceMap:v1';

const normalizePlate = (s) =>
    (s || '').toString().trim().toUpperCase().replace(/\s+/g, '').replace(/[._]/g, '-').replace(/--+/g, '-');

function reviveMap(obj) {
    // lưu dạng entries => revive lại Map
    return new Map(obj?.imeiToPlate || []);
}

function serializeMap(map) {
    return { imeiToPlate: Array.from((map || new Map()).entries()) };
}

export function useLastCruiseDeviceMap({ buildImeiToLicensePlateMap }) {
    // đọc cache localStorage ngay lập tức
    const fallbackMap = useMemo(() => {
        if (typeof window === 'undefined') return undefined;
        try {
            const raw = localStorage.getItem(MAP_CACHE_KEY);
            if (!raw) return undefined;
            return reviveMap(JSON.parse(raw));
        } catch {
            return undefined;
        }
    }, []);

    const fetcher = async () => {
        const token = getAuthToken();
        if (!token) return new Map();

        const res = await buildImeiToLicensePlateMap(token);
        const map = res?.imeiToPlate ?? res ?? new Map();

        if (typeof window !== 'undefined') {
            localStorage.setItem(MAP_CACHE_KEY, JSON.stringify(serializeMap(map)));
        }
        return map;
    };

    const { data, isLoading } = useSWR('lastCruiseDeviceMap', fetcher, {
        fallbackData: fallbackMap,
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        dedupingInterval: 60 * 60 * 1000,
        shouldRetryOnError: false,
    });

    const imeiToPlate = data || new Map();

    // reverse map: plate -> imeis
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

    return {
        imeiToPlate,
        plateToImeis,
        // nếu có fallback => coi như không loading
        loadingDeviceMap: isLoading && !fallbackMap,
    };
}
