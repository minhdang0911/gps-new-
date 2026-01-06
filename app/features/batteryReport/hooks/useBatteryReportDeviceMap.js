import useSWR from 'swr';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getAuthToken } from '../utils';

const MAP_CACHE_KEY = 'batteryReportDeviceMap:v3';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h

const normalizePlate = (s) =>
    (s || '').toString().trim().toUpperCase().replace(/\s+/g, '').replace(/[._]/g, '-').replace(/--+/g, '-');

function reviveMaps(obj) {
    return {
        imeiToPlate: new Map(obj?.imeiToPlate || []),
        plateToImeis: new Map(obj?.plateToImeis || []),
        updatedAt: obj?.updatedAt || 0,
    };
}

function serializeMaps({ imeiToPlate, plateToImeis, updatedAt }) {
    return {
        imeiToPlate: Array.from((imeiToPlate || new Map()).entries()),
        plateToImeis: Array.from((plateToImeis || new Map()).entries()),
        updatedAt: updatedAt || Date.now(),
    };
}

function buildReverseMap(imeiToPlate) {
    const plateToImeis = new Map();
    for (const [imeiRaw, plateRaw] of (imeiToPlate || new Map()).entries()) {
        const imei = String(imeiRaw || '').trim();
        const plate = normalizePlate(plateRaw);
        if (!imei || !plate) continue;

        const arr = plateToImeis.get(plate) || [];
        arr.push(imei);
        plateToImeis.set(plate, arr);
    }
    return plateToImeis;
}

export function useBatteryReportDeviceMap({ buildImeiToLicensePlateMap }) {
    // ✅ state chứa fallback từ localStorage (đọc sau render)
    const [fallback, setFallback] = useState(undefined);

    // ✅ dùng ref để tránh gọi Date.now trong render (có 1 giá trị "now" ổn định)
    const nowRef = useRef(0);
    if (nowRef.current === 0 && typeof window !== 'undefined') {
        nowRef.current = Date.now();
    }

    useEffect(() => {
        if (typeof window === 'undefined') return;

        try {
            const raw = localStorage.getItem(MAP_CACHE_KEY);
            if (!raw) return;

            const revived = reviveMaps(JSON.parse(raw));
            const age = nowRef.current - (revived.updatedAt || 0);
            if (age > CACHE_TTL_MS) return;

            if (!revived.plateToImeis || revived.plateToImeis.size === 0) {
                revived.plateToImeis = buildReverseMap(revived.imeiToPlate);
            }

            setFallback(revived);
        } catch {
            // ignore
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetcher = async () => {
        const token = getAuthToken();

        // helper: write cache (chỉ chạy client)
        const writeCache = (payload) => {
            if (typeof window === 'undefined') return;
            localStorage.setItem(MAP_CACHE_KEY, JSON.stringify(serializeMaps(payload)));
        };

        if (!token) {
            const payload = {
                imeiToPlate: new Map(),
                plateToImeis: new Map(),
                updatedAt: Date.now(),
            };
            writeCache(payload);
            return payload;
        }

        const res = await buildImeiToLicensePlateMap(token);

        const imeiToPlate = res?.imeiToPlate || new Map();
        const plateToImeis =
            res?.plateToImeis && res.plateToImeis.size > 0 ? res.plateToImeis : buildReverseMap(imeiToPlate);

        const payload = { imeiToPlate, plateToImeis, updatedAt: Date.now() };
        writeCache(payload);
        return payload;
    };

    const swrKey = 'batteryReportDeviceMap';

    const { data, isLoading, mutate } = useSWR(swrKey, fetcher, {
        // ✅ fallbackData chỉ set khi đã đọc xong (sau render)
        fallbackData: fallback,
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        dedupingInterval: CACHE_TTL_MS,
        shouldRetryOnError: false,
    });

    return {
        imeiToPlate: data?.imeiToPlate || new Map(),
        plateToImeis: data?.plateToImeis || new Map(),
        loadingDeviceMap: isLoading && !fallback,

        refreshDeviceMap: () => mutate(),
        clearDeviceMapCache: () => {
            if (typeof window !== 'undefined') localStorage.removeItem(MAP_CACHE_KEY);
            setFallback(undefined);
        },
    };
}
