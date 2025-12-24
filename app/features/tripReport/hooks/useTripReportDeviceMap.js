// features/tripReport/hooks/useTripReportDeviceMap.js
import useSWR from 'swr';
import { useMemo } from 'react';
import { getAuthToken } from '../utils';

const MAP_CACHE_KEY = 'tripReportDeviceMap:v1';

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

export function useTripReportDeviceMap({ buildImeiToLicensePlateMap }) {
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

        if (typeof window !== 'undefined') {
            localStorage.setItem(MAP_CACHE_KEY, JSON.stringify(serializeMaps({ imeiToPlate, plateToImeis })));
        }
        return { imeiToPlate, plateToImeis };
    };

    const { data, isLoading } = useSWR('tripReportDeviceMap', fetcher, {
        fallbackData: fallback,
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        dedupingInterval: 60 * 60 * 1000,
        shouldRetryOnError: false,
    });

    return {
        imeiToPlate: data?.imeiToPlate || new Map(),
        plateToImeis: data?.plateToImeis || new Map(),
        loadingDeviceMap: isLoading && !fallback,
    };
}
