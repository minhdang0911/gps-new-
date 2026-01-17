'use client';

import useSWR from 'swr';
import { useMemo } from 'react';
import { getAuthToken } from '../features/batteryReport/utils';
import { getDevices } from '../lib/api/devices'; // <-- chỉnh path đúng

const MAP_CACHE_KEY = 'maintenanceDeviceMap:v1';

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

async function buildImeiPlateMap() {
    const token = getAuthToken();
    if (!token) return { imeiToPlate: new Map(), plateToImeis: new Map() };

    const res = await getDevices({ page: 1, limit: 2000 });
    const list = res?.devices || [];

    const imeiToPlate = new Map();
    const plateToImeis = new Map();

    // ✅ Thêm hàm normalize (giống với component)
    const normalizePlate = (s) =>
        (s || '')
            .toString()
            .trim()
            .toUpperCase()
            .replace(/\s+/g, '')
            .replace(/[.\-_]+/g, '-')
            .replace(/--+/g, '-');

    for (const d of list) {
        const imei = String(d?.imei || '').trim();
        const plateRaw = String(d?.license_plate || '').trim();
        const plate = normalizePlate(plateRaw); // ✅ Normalize trước khi lưu

        if (imei) imeiToPlate.set(imei, plate || '');

        if (plate) {
            const cur = plateToImeis.get(plate) || [];
            if (imei && !cur.includes(imei)) cur.push(imei);
            plateToImeis.set(plate, cur);
        }
    }

    if (typeof window !== 'undefined') {
        localStorage.setItem(MAP_CACHE_KEY, JSON.stringify(serializeMaps({ imeiToPlate, plateToImeis })));
    }

    return { imeiToPlate, plateToImeis };
}

export function useMaintenanceDeviceMap() {
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

    const { data, isLoading } = useSWR('maintenanceDeviceMap', buildImeiPlateMap, {
        fallbackData: fallback,
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        dedupingInterval: 60 * 60 * 1000, // 1h
        shouldRetryOnError: false,
    });

    return {
        imeiToPlate: data?.imeiToPlate || new Map(),
        plateToImeis: data?.plateToImeis || new Map(),
        loadingDeviceMap: isLoading && !fallback,
    };
}
