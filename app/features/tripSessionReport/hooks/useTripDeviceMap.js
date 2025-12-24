// features/tripSessionReport/hooks/useTripDeviceMap.js
import useSWR from 'swr';
import { useMemo } from 'react';
import { getAuthToken } from '../utils';

const MAP_CACHE_KEY = 'tripDeviceMap:v1';

function reviveMaps(obj) {
    return {
        imeiToPlate: new Map(obj?.imeiToPlate || []),
        plateToImeis: new Map(obj?.plateToImeis || []),
    };
}

function serializeMaps({ imeiToPlate, plateToImeis }) {
    return {
        imeiToPlate: Array.from(imeiToPlate.entries()),
        plateToImeis: Array.from(plateToImeis.entries()),
    };
}

export function useTripDeviceMap({ buildImeiToLicensePlateMap }) {
    // đọc cache localStorage ngay lập tức
    const fallback = useMemo(() => {
        if (typeof window === 'undefined') return undefined;
        try {
            const raw = localStorage.getItem(MAP_CACHE_KEY);
            if (!raw) return undefined;
            return reviveMaps(JSON.parse(raw));
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

        // persist cache
        if (typeof window !== 'undefined') {
            localStorage.setItem(MAP_CACHE_KEY, JSON.stringify(serializeMaps({ imeiToPlate, plateToImeis })));
        }

        return { imeiToPlate, plateToImeis };
    };

    const { data, isLoading } = useSWR('tripDeviceMap', fetcher, {
        fallbackData: fallback, // ✅ có map ngay nếu cache có
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        dedupingInterval: 60 * 60 * 1000, // 1h
        shouldRetryOnError: false,
    });

    return {
        imeiToPlate: data?.imeiToPlate || new Map(),
        plateToImeis: data?.plateToImeis || new Map(),
        // nếu có fallback thì coi như không loading
        loadingDeviceMap: isLoading && !fallback,
    };
}
