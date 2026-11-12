import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
    reverseGeocodeAddress,
    reverseGeocodeBatch,
    getCachedAddressSync,
    getCoordCacheKey,
    isValidGeocodeCoord,
} from '../../../lib/address/reverseGeocode';

/**
 * Lazy-resolve địa chỉ cho các dòng đang hiển thị trên trang bảng Last Cruise:
 * 1) Đọc L1/IndexedDB ngay (0ms)
 * 2) Hỏi nhanh batch MongoDB (resolveMissing: false) để hiện ngay toàn bộ điểm đã lưu
 * 3) Các điểm thật sự chưa có trong DB thì resolve dần từng dòng (có tới đâu hiện tới đó, không kẹt chung)
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

        const entries = Array.from(missingTasks.entries()); // [key, coord]

        const clearLoadingKey = (key) => {
            inflightKeysRef.current.delete(key);
            if (!mountedRef.current) return;
            setLoadingByKey((prev) => {
                if (!prev[key]) return prev;
                const next = { ...prev };
                delete next[key];
                return next;
            });
        };

        (async () => {
            // Bước 1: Kiểm tra nhanh MongoDB read-only (~50-150ms) cho cả trang
            let dbHits = {};
            try {
                dbHits = await reverseGeocodeBatch(
                    entries.map(([, coord]) => coord),
                    { lang, isEn, resolveMissing: false },
                );
            } catch {
                dbHits = {};
            }

            const dbResolvedUpdates = {};
            const remaining = [];

            for (const [key, coord] of entries) {
                const hitAddr = dbHits?.[key]?.address;
                if (hitAddr) {
                    addressByKeyRef.current[key] = hitAddr;
                    dbResolvedUpdates[key] = hitAddr;
                    clearLoadingKey(key);
                } else {
                    remaining.push([key, coord]);
                }
            }

            if (mountedRef.current && Object.keys(dbResolvedUpdates).length > 0) {
                setAddressByKey((prev) => ({ ...prev, ...dbResolvedUpdates }));
            }

            if (remaining.length === 0) return;

            // Bước 2: Resolve từng tọa độ chưa có trong DB (xong dòng nào cập nhật UI ngay dòng đó)
            remaining.forEach(async ([key, coord]) => {
                try {
                    const res = await reverseGeocodeAddress(coord.lat, coord.lon, { lang, isEn });
                    const addr = res?.address || '';
                    addressByKeyRef.current[key] = addr;

                    if (mountedRef.current) {
                        setAddressByKey((prev) => ({ ...prev, [key]: addr }));
                    }
                } catch {
                    addressByKeyRef.current[key] = '';
                    if (mountedRef.current) {
                        setAddressByKey((prev) => ({ ...prev, [key]: '' }));
                    }
                } finally {
                    clearLoadingKey(key);
                }
            });
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
