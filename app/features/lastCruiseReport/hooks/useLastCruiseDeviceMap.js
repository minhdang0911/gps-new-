import { useEffect, useMemo, useState } from 'react';
import { getAuthToken } from '../utils'; // giữ đúng path như bạn
// nếu file utils khác path thì giữ như cũ của bạn

const normalizePlate = (s) =>
    (s || '').toString().trim().toUpperCase().replace(/\s+/g, '').replace(/[._]/g, '-').replace(/--+/g, '-');

export function useLastCruiseDeviceMap({ buildImeiToLicensePlateMap }) {
    const [imeiToPlate, setImeiToPlate] = useState(new Map());
    const [loadingDeviceMap, setLoadingDeviceMap] = useState(false);

    useEffect(() => {
        const loadMaps = async () => {
            try {
                setLoadingDeviceMap(true);

                const token = getAuthToken();
                if (!token) {
                    setImeiToPlate(new Map());
                    return;
                }

                // ✅ quan trọng: build map cần token
                const res = await buildImeiToLicensePlateMap(token);

                // res có thể là { imeiToPlate } hoặc trực tiếp Map tuỳ helper
                const map = res?.imeiToPlate ?? res;
                setImeiToPlate(map || new Map());
            } catch (e) {
                console.error('Load device map failed:', e);
                setImeiToPlate(new Map());
            } finally {
                setLoadingDeviceMap(false);
            }
        };

        loadMaps();
    }, [buildImeiToLicensePlateMap]);

    // ✅ reverse: plate -> imeis (devs)
    const plateToImeis = useMemo(() => {
        const m = new Map();
        const map = imeiToPlate || new Map();

        // map phải là Map mới có entries()
        const entries = map instanceof Map ? map.entries() : Object.entries(map || {});
        for (const [imei, plate] of entries) {
            if (!plate) continue;
            const key = normalizePlate(plate);
            const arr = m.get(key) || [];
            arr.push(String(imei));
            m.set(key, arr);
        }
        return m;
    }, [imeiToPlate]);

    return { imeiToPlate, plateToImeis, loadingDeviceMap };
}
