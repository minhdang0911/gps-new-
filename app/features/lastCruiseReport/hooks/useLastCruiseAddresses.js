// app/features/lastCruiseReport/hooks/useLastCruiseAddresses.js
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
    reverseGeocodeBatch,
    getCachedAddressSync,
    getCoordCacheKey,
    isValidGeocodeCoord,
    ensureAddressCacheHydrated,
} from '../../../lib/address/reverseGeocode';
import {
    clusterCoordinatesByProximity,
    splitArrayIntoChunks,
    executeChunkedBatchGeocode,
} from '../../../lib/address/spatialGeocodeCluster';

/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║ IKY-InstantGeocodeCore: Two-Phase Immediate Address Hydration Engine       ║
 * ║ - Phase 0: 0ms Instant L1/IndexedDB 50m Proximity Cache lookup            ║
 * ║ - Phase 1: 30ms Ultra-fast MongoDB Batch ($in + $nearSphere 50m)          ║
 * ║ - Phase 2: Deferred background resolution for truly new coordinates       ║
 * ║ - Background: Full-dataset prefetching so all pages & Excel render 0ms     ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
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

    // 1. Resolve trang hiện tại: 2-Phase tức thì (IndexedDB 0ms -> MongoDB 30ms -> Goong ngầm)
    useEffect(() => {
        if (!enabled || !Array.isArray(rows) || rows.length === 0) return;

        let isEffectActive = true;

        (async () => {
            // Đảm bảo cache IndexedDB & không gian lân cận 50m đã hydrate vào memoryCache
            await ensureAddressCacheHydrated();
            if (!isEffectActive || !mountedRef.current) return;

            const syncHits = {};
            const missingTasks = new Map();

            for (const rowItem of rows) {
                if (!rowItem || rowItem.address) continue;
                if (!isValidGeocodeCoord(rowItem.lat, rowItem.lon)) continue;

                const coordKey = getCoordCacheKey(rowItem.lat, rowItem.lon, lang);
                if (Object.prototype.hasOwnProperty.call(addressByKeyRef.current, coordKey)) {
                    syncHits[coordKey] = addressByKeyRef.current[coordKey];
                    continue;
                }

                // Kiểm tra chính xác hoặc bán kính 50m trong client memoryCache
                const cachedSync = getCachedAddressSync(rowItem.lat, rowItem.lon, { lang, isEn });
                if (cachedSync?.address) {
                    syncHits[coordKey] = cachedSync.address;
                    addressByKeyRef.current[coordKey] = cachedSync.address;
                    continue;
                }

                if (!inflightKeysRef.current.has(coordKey) && !missingTasks.has(coordKey)) {
                    missingTasks.set(coordKey, {
                        lat: Number(rowItem.lat),
                        lon: Number(rowItem.lon),
                        lang,
                    });
                }
            }

            // Giai đoạn 0: Cập nhật ngay các kết quả có trong cache L1/IndexedDB (0ms tức thì)
            if (Object.keys(syncHits).length > 0) {
                setAddressByKey((prev) => ({ ...prev, ...syncHits }));
            }

            if (missingTasks.size === 0) return;

            const missingCoordinateList = Array.from(missingTasks.values());

            // Gom cụm không gian 35m để gom nhóm các xe cùng bãi/khu vực
            const { uniqueMedoidList, satelliteToMedoidKeyMap } = clusterCoordinatesByProximity(
                missingCoordinateList,
                35
            );

            const clearLoadingKey = (coordKey) => {
                inflightKeysRef.current.delete(coordKey);
                if (!isEffectActive || !mountedRef.current) return;
                setLoadingByKey((prev) => {
                    if (!prev[coordKey]) return prev;
                    const nextState = { ...prev };
                    delete nextState[coordKey];
                    return nextState;
                });
            };

            const newLoadingKeys = {};
            for (const coordKey of missingTasks.keys()) {
                inflightKeysRef.current.add(coordKey);
                newLoadingKeys[coordKey] = true;
            }
            setLoadingByKey((prev) => ({ ...prev, ...newLoadingKeys }));

            try {
                // Giai đoạn 1: Truy vấn SIÊU TỐC từ MongoDB Server (resolveMissing = false, chỉ đọc DB trong 30ms)
                const fastDbChunkPayloads = splitArrayIntoChunks(uniqueMedoidList, 50);
                const fastDbResultMap = await executeChunkedBatchGeocode(
                    fastDbChunkPayloads,
                    (chunk) => reverseGeocodeBatch(chunk, { lang, isEn, resolveMissing: false }),
                    { delayBetweenChunksMs: 0 }
                );

                const fastResolvedUpdates = {};
                const stillUnresolvedMedoids = [];

                for (const medoid of uniqueMedoidList) {
                    const resolvedAddress = fastDbResultMap?.[medoid.key]?.address;
                    if (resolvedAddress) {
                        fastResolvedUpdates[medoid.key] = resolvedAddress;
                    } else {
                        stillUnresolvedMedoids.push(medoid);
                    }
                }

                // Gán địa chỉ từ MongoDB cho các điểm vệ tinh cùng cụm
                for (const [satelliteKey, matchedMedoidKey] of satelliteToMedoidKeyMap.entries()) {
                    if (fastResolvedUpdates[matchedMedoidKey]) {
                        const address = fastResolvedUpdates[matchedMedoidKey];
                        addressByKeyRef.current[satelliteKey] = address;
                        fastResolvedUpdates[satelliteKey] = address;
                        clearLoadingKey(satelliteKey);
                    }
                }

                if (isEffectActive && mountedRef.current && Object.keys(fastResolvedUpdates).length > 0) {
                    setAddressByKey((prev) => ({ ...prev, ...fastResolvedUpdates }));
                }

                // Nếu tất cả đã có sẵn trong MongoDB, hoàn tất ngay lập tức (< 50ms)
                if (stillUnresolvedMedoids.length === 0) return;

                // Giai đoạn 2: Chỉ những tọa độ chưa từng xuất hiện trên DB mới gọi Goong trực tiếp từ client (~126ms)
                // và tự động lưu ngược vào MongoDB Atlas trong nền
                const slowResolvedUpdates = {};
                await Promise.all(
                    stillUnresolvedMedoids.map(async (medoid) => {
                        try {
                            const res = await reverseGeocodeAddress(medoid.lat, medoid.lon, { lang, isEn });
                            if (res?.address) {
                                for (const [satKey, targetMedoidKey] of satelliteToMedoidKeyMap.entries()) {
                                    if (targetMedoidKey === medoid.key) {
                                        addressByKeyRef.current[satKey] = res.address;
                                        slowResolvedUpdates[satKey] = res.address;
                                        clearLoadingKey(satKey);
                                    }
                                }
                            }
                        } catch {}
                    })
                );

                if (isEffectActive && mountedRef.current && Object.keys(slowResolvedUpdates).length > 0) {
                    setAddressByKey((prev) => ({ ...prev, ...slowResolvedUpdates }));
                }
            } catch {
                for (const coordKey of missingTasks.keys()) {
                    addressByKeyRef.current[coordKey] = '';
                    clearLoadingKey(coordKey);
                }
                if (isEffectActive && mountedRef.current) {
                    setAddressByKey((prev) => ({ ...prev }));
                }
            }
        })();

        return () => {
            isEffectActive = false;
        };
    }, [rows, lang, isEn, enabled]);

    // 2. Nạp ngầm toàn bộ danh sách (allRows) từ MongoDB vào Cache client ngay khi có dữ liệu
    useEffect(() => {
        if (!enabled || !Array.isArray(allRows) || allRows.length === 0) return;

        if (prefetchTimerRef.current) {
            clearTimeout(prefetchTimerRef.current);
            prefetchTimerRef.current = null;
        }

        prefetchTimerRef.current = setTimeout(async () => {
            if (!mountedRef.current) return;

            const allUncachedCoordinates = [];
            for (const item of allRows) {
                if (!item || item.address || !isValidGeocodeCoord(item.lat, item.lon)) continue;
                const coordKey = getCoordCacheKey(item.lat, item.lon, lang);
                if (addressByKeyRef.current[coordKey]) continue;

                const cached = getCachedAddressSync(item.lat, item.lon, { lang, isEn });
                if (cached?.address) {
                    addressByKeyRef.current[coordKey] = cached.address;
                    continue;
                }
                allUncachedCoordinates.push({ lat: Number(item.lat), lon: Number(item.lon), lang });
            }

            if (allUncachedCoordinates.length === 0) return;

            try {
                const { uniqueMedoidList, satelliteToMedoidKeyMap } = clusterCoordinatesByProximity(
                    allUncachedCoordinates,
                    35
                );

                // Nạp nhanh toàn bộ từ MongoDB server
                const bulkChunks = splitArrayIntoChunks(uniqueMedoidList, 50);
                const bulkResultMap = await executeChunkedBatchGeocode(
                    bulkChunks,
                    (chunk) => reverseGeocodeBatch(chunk, { lang, isEn, resolveMissing: false }),
                    { delayBetweenChunksMs: 0 }
                );

                const bulkUpdates = {};
                for (const [satelliteKey, matchedMedoidKey] of satelliteToMedoidKeyMap.entries()) {
                    const resolvedAddress = bulkResultMap?.[matchedMedoidKey]?.address;
                    if (resolvedAddress) {
                        addressByKeyRef.current[satelliteKey] = resolvedAddress;
                        bulkUpdates[satelliteKey] = resolvedAddress;
                    }
                }

                if (mountedRef.current && Object.keys(bulkUpdates).length > 0) {
                    setAddressByKey((prev) => ({ ...prev, ...bulkUpdates }));
                }
            } catch {
                // Background warmup lỗi thì bỏ qua
            }
        }, 1200);

        return () => {
            if (prefetchTimerRef.current) {
                clearTimeout(prefetchTimerRef.current);
                prefetchTimerRef.current = null;
            }
        };
    }, [allRows, enabled, lang, isEn]);

    const enrichRows = useCallback(
        (inputRows = []) => {
            if (!Array.isArray(inputRows) || inputRows.length === 0) return inputRows;

            return inputRows.map((row) => {
                if (!row) return row;
                if (row.address) return { ...row, __addressLoading: false };
                if (!isValidGeocodeCoord(row.lat, row.lon)) return { ...row, address: '', __addressLoading: false };

                const coordKey = getCoordCacheKey(row.lat, row.lon, lang);
                const resolved =
                    addressByKey[coordKey] ??
                    getCachedAddressSync(row.lat, row.lon, { lang, isEn })?.address ??
                    '';

                return {
                    ...row,
                    address: resolved,
                    __addressLoading: !resolved && Boolean(loadingByKey[coordKey]),
                };
            });
        },
        [addressByKey, loadingByKey, lang, isEn]
    );

    const enrichedRows = useMemo(() => enrichRows(rows), [enrichRows, rows]);

    return {
        enrichedRows,
        enrichRows,
    };
}
