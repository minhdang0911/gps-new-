import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
    reverseGeocodeBatch,
    getCachedAddressSync,
    getCoordCacheKey,
    isValidGeocodeCoord,
} from '../../../lib/address/reverseGeocode';

/**
 * Lazy-resolve địa chỉ cho các dòng đang hiển thị trên bảng Last Cruise:
 * 1) Đọc L1/IndexedDB ngay lập tức (0ms)
 * 2) Gửi 1 REQUEST BATCH DUY NHẤT (/api/geocode/batch) cho các dòng còn thiếu:
 *    - Server kiểm tra chính xác + bán kính 50m trong MongoDB
 *    - Điểm nào ngoài 50m thì Server gọi Goong song song (300ms) rồi lưu MongoDB
 *    - Cả trang nhận kết quả trọn gói trong ~0.4s - 0.6s
 * 3) Khi rảnh (idle), tự động nạp ngầm (prefetch) trang kế tiếp vào DB để click là ăn ngay 0ms
 */
export function useLastCruiseAddresses({ rows = [], allRows = [], isEn = false, enabled = true }) {
    const lang = isEn ? 'en' : 'vi';
    const [addressByKey, setAddressByKey] = useState({});
    const [loadingByKey, setLoadingByKey] = useState({});

    const addressByKeyRef = useRef({});
    const inflightKeysRef = useRef(new Set());
    const mountedRef = useRef(true);
    const prefetchTimerRef = useRef(null);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (prefetchTimerRef.current) {
                clearTimeout(prefetchTimerRef.current);
                prefetchTimerRef.current = null;
            }
        };
    }, []);

    // 1. Resolve trang hiện tại
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

        if (missingTasks.size === 0 && Object.keys(syncHits).length === 0) return;

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
            if (!mountedRef.current) return;

            if (Object.keys(syncHits).length > 0) {
                setAddressByKey((prev) => ({ ...prev, ...syncHits }));
            }

            if (entries.length === 0) return;

            const newLoadingKeys = {};
            for (const key of missingTasks.keys()) {
                inflightKeysRef.current.add(key);
                newLoadingKeys[key] = true;
            }
            setLoadingByKey((prev) => ({ ...prev, ...newLoadingKeys }));

            try {
                // Gửi 1 batch duy nhất lên server (check 50m + Goong song song)
                const batchMap = await reverseGeocodeBatch(
                    entries.map(([, coord]) => coord),
                    { lang, isEn, resolveMissing: true },
                );

                const resolvedUpdates = {};
                for (const [key] of entries) {
                    const addr = batchMap?.[key]?.address || '';
                    addressByKeyRef.current[key] = addr;
                    resolvedUpdates[key] = addr;
                    clearLoadingKey(key);
                }

                if (mountedRef.current && Object.keys(resolvedUpdates).length > 0) {
                    setAddressByKey((prev) => ({ ...prev, ...resolvedUpdates }));
                }
            } catch {
                for (const [key] of entries) {
                    addressByKeyRef.current[key] = '';
                    clearLoadingKey(key);
                }
                if (mountedRef.current) {
                    setAddressByKey((prev) => ({ ...prev }));
                }
            }
        })();
    }, [rows, lang, isEn, enabled]);

    // 2. Tự động nạp ngầm (Prefetch) trang kế tiếp vào DB trong lúc người dùng đọc trang hiện tại
    useEffect(() => {
        if (!enabled || !Array.isArray(allRows) || allRows.length === 0 || !Array.isArray(rows) || rows.length === 0) {
            return;
        }

        if (prefetchTimerRef.current) {
            clearTimeout(prefetchTimerRef.current);
            prefetchTimerRef.current = null;
        }

        prefetchTimerRef.current = setTimeout(async () => {
            if (!mountedRef.current) return;

            const lastVisibleRow = rows[rows.length - 1];
            const lastIdx = allRows.indexOf(lastVisibleRow);
            if (lastIdx === -1 || lastIdx + 1 >= allRows.length) return;

            const pageSize = rows.length;
            const nextSlice = allRows.slice(lastIdx + 1, lastIdx + 1 + pageSize);

            const nextMissing = [];
            for (const item of nextSlice) {
                if (!item || item.address || !isValidGeocodeCoord(item.lat, item.lon)) continue;
                const key = getCoordCacheKey(item.lat, item.lon, lang);
                if (addressByKeyRef.current[key]) continue;
                const cached = getCachedAddressSync(item.lat, item.lon, { lang, isEn });
                if (cached?.address) {
                    addressByKeyRef.current[key] = cached.address;
                    continue;
                }
                if (!inflightKeysRef.current.has(key)) {
                    nextMissing.push({ lat: Number(item.lat), lon: Number(item.lon), lang });
                }
            }

            if (nextMissing.length === 0) return;

            try {
                const prefetchMap = await reverseGeocodeBatch(nextMissing, {
                    lang,
                    isEn,
                    resolveMissing: true,
                });
                for (const item of nextMissing) {
                    const key = getCoordCacheKey(item.lat, item.lon, lang);
                    const addr = prefetchMap?.[key]?.address;
                    if (addr) {
                        addressByKeyRef.current[key] = addr;
                    }
                }
            } catch {
                // Background prefetch fail thì bỏ qua, trang sau tự tải lại
            }
        }, 800);

        return () => {
            if (prefetchTimerRef.current) {
                clearTimeout(prefetchTimerRef.current);
                prefetchTimerRef.current = null;
            }
        };
    }, [rows, allRows, enabled, lang, isEn]);

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
