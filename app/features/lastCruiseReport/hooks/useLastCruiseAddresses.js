import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
    reverseGeocodeBatch,
    getCachedAddressSync,
    getCoordCacheKey,
    isValidGeocodeCoord,
} from '../../../lib/address/reverseGeocode';

/**
 * Lazy-resolve địa chỉ cho các dòng đang hiển thị trên trang bảng Last Cruise.
 * Kết hợp L1/IndexedDB (0ms) -> 1 batch request /api/geocode/batch (MongoDB + Goong).
 */
export function useLastCruiseAddresses({ rows = [], isEn = false, enabled = true }) {
    const lang = isEn ? 'en' : 'vi';
    const [addressByKey, setAddressByKey] = useState({});
    const [loadingByKey, setLoadingByKey] = useState({});

    const addressByKeyRef = useRef({});
    const inflightKeysRef = useRef(new Set());
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        if (!enabled || !Array.isArray(rows) || rows.length === 0) return;

        const syncHits = {};
        const missingTasks = new Map(); // coordKey -> { lat, lon, lang }

        for (const r of rows) {
            if (!r || r.address) continue;
            if (!isValidGeocodeCoord(r.lat, r.lon)) continue;

            const key = getCoordCacheKey(r.lat, r.lon, lang);
            if (Object.prototype.hasOwnProperty.call(addressByKeyRef.current, key)) continue;

            const cached = getCachedAddressSync(r.lat, r.lon, { lang, isEn });
            if (cached?.address) {
                syncHits[key] = cached.address;
                addressByKeyRef.current[key] = cached.address;
                continue;
            }

            if (!inflightKeysRef.current.has(key) && !missingTasks.has(key)) {
                missingTasks.set(key, { lat: Number(r.lat), lon: Number(r.lon), lang });
            }
        }

        if (Object.keys(syncHits).length > 0) {
            setAddressByKey((prev) => ({ ...prev, ...syncHits }));
        }

        if (missingTasks.size === 0) return;

        const newLoadingKeys = {};
        for (const key of missingTasks.keys()) {
            inflightKeysRef.current.add(key);
            newLoadingKeys[key] = true;
        }
        setLoadingByKey((prev) => ({ ...prev, ...newLoadingKeys }));

        const keysToResolve = Array.from(missingTasks.keys());
        const itemsToResolve = Array.from(missingTasks.values());

        (async () => {
            try {
                const batchMap = await reverseGeocodeBatch(itemsToResolve, { lang, isEn });
                const resolvedUpdates = {};

                for (const key of keysToResolve) {
                    const addr = batchMap?.[key]?.address || '';
                    addressByKeyRef.current[key] = addr;
                    resolvedUpdates[key] = addr;
                }

                if (mountedRef.current) {
                    setAddressByKey((prev) => ({ ...prev, ...resolvedUpdates }));
                }
            } catch {
                const emptyUpdates = {};
                for (const key of keysToResolve) {
                    addressByKeyRef.current[key] = '';
                    emptyUpdates[key] = '';
                }
                if (mountedRef.current) {
                    setAddressByKey((prev) => ({ ...prev, ...emptyUpdates }));
                }
            } finally {
                for (const key of keysToResolve) {
                    inflightKeysRef.current.delete(key);
                }
                if (mountedRef.current) {
                    setLoadingByKey((prev) => {
                        let changed = false;
                        const next = { ...prev };
                        for (const key of keysToResolve) {
                            if (next[key]) {
                                delete next[key];
                                changed = true;
                            }
                        }
                        return changed ? next : prev;
                    });
                }
            }
        })();
    }, [rows, lang, isEn, enabled]);

    const enrichRows = useCallback(
        (inputRows = []) => {
            if (!Array.isArray(inputRows) || inputRows.length === 0) return inputRows;

            return inputRows.map((row) => {
                if (!row) return row;
                if (row.address) {
                    return { ...row, __addressLoading: false };
                }
                if (!isValidGeocodeCoord(row.lat, row.lon)) {
                    return { ...row, address: '', __addressLoading: false };
                }

                const key = getCoordCacheKey(row.lat, row.lon, lang);
                const resolved =
                    addressByKey[key] ??
                    getCachedAddressSync(row.lat, row.lon, { lang, isEn })?.address ??
                    '';

                return {
                    ...row,
                    address: resolved,
                    __addressLoading: !resolved && Boolean(loadingByKey[key]),
                };
            });
        },
        [addressByKey, loadingByKey, lang, isEn],
    );

    const enrichedRows = useMemo(() => enrichRows(rows), [enrichRows, rows]);

    return {
        enrichedRows,
        enrichRows,
    };
}
