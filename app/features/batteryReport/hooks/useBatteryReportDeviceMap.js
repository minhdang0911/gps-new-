// features/batteryReport/hooks/useBatteryReportDeviceMap.js
import useSWR from 'swr';
import { useMemo } from 'react';
import { getAuthToken } from '../utils';

const MAP_CACHE_KEY = 'batteryReportDeviceMap:v1';

function reviveMap(obj) {
    return new Map(obj?.imeiToPlate || []);
}

function serializeMap(map) {
    return { imeiToPlate: Array.from((map || new Map()).entries()) };
}

export function useBatteryReportDeviceMap({ buildImeiToLicensePlateMap }) {
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
        const map = res?.imeiToPlate ?? new Map();

        if (typeof window !== 'undefined') {
            localStorage.setItem(MAP_CACHE_KEY, JSON.stringify(serializeMap(map)));
        }
        return map;
    };

    const { data, isLoading } = useSWR('batteryReportDeviceMap', fetcher, {
        fallbackData: fallbackMap,
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        dedupingInterval: 60 * 60 * 1000,
        shouldRetryOnError: false,
    });

    return {
        imeiToPlate: data || new Map(),
        loadingDeviceMap: isLoading && !fallbackMap,
    };
}
