import useSWR from 'swr';
import { useMemo } from 'react';
import { getAuthToken } from '../utils';

const MAP_CACHE_KEY = 'deviceMap:v1';

function reviveMaps(obj) {
    const imeiToPlate = new Map(obj?.imeiToPlate || []);
    const plateToImeis = new Map(obj?.plateToImeis || []);
    return { imeiToPlate, plateToImeis };
}

function serializeMaps({ imeiToPlate, plateToImeis }) {
    return {
        imeiToPlate: Array.from(imeiToPlate.entries()),
        plateToImeis: Array.from(plateToImeis.entries()),
    };
}

export function useChargingDeviceMap({ buildImeiToLicensePlateMap }) {
    // đọc cache localStorage ngay lập tức (sync)
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

        // persist
        if (typeof window !== 'undefined') {
            localStorage.setItem(MAP_CACHE_KEY, JSON.stringify(serializeMaps({ imeiToPlate, plateToImeis })));
        }

        return { imeiToPlate, plateToImeis };
    };

    const { data, isLoading } = useSWR(
        'chargingDeviceMap', // SWR key global
        fetcher,
        {
            fallbackData: fallback, // ✅ có data ngay -> hết loading nhẹ
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
            dedupingInterval: 60 * 60 * 1000, // 1h
            shouldRetryOnError: false,
        },
    );

    return {
        imeiToPlate: data?.imeiToPlate || new Map(),
        plateToImeis: data?.plateToImeis || new Map(),
        loadingDeviceMap: isLoading && !fallback, // nếu đã có fallback thì coi như không loading
    };
}
