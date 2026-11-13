// app/lib/address/addressCache.js

import { getDistanceMeters } from '../../util/geo';

const DB_NAME = 'iky_address_cache_v1';
const DB_VERSION = 1;
const STORE_NAME = 'addresses';

export const ADDRESS_CACHE_TTL_MS = 365 * 24 * 60 * 60 * 1000; // Lưu dài hạn 1 năm trong IndexedDB
export const ADDRESS_NEGATIVE_TTL_MS = 5 * 60 * 1000; // 5 phút cho tọa độ không giải mã được
export const MAX_ADDRESS_CACHE_ENTRIES = 50000; // Lưu tối đa 50.000 tọa độ (~10MB IDB)
const MAX_NEGATIVE_ENTRIES = 1000;
const CELL_DEG = 0.0005; // ~55.5m mỗi ô lưới (độ phủ 3x3 ~166m)
export const PROXIMITY_RADIUS_METERS = 50; // Gom điểm lân cận trong bán kính 50m
export const MAX_CONCURRENT_GEOCODE_REQUESTS = 4;
const TOUCH_IDB_MIN_INTERVAL_MS = 60 * 60 * 1000; // chỉ sync lastUsedAt xuống IDB tối đa mỗi 1h/entry

const memoryCache = new Map();
const spatialIndex = new Map(); // cellKey -> Set<cacheKey>
const negativeCache = new Map(); // cacheKey -> expiresAt
const inflightRequests = new Map(); // cacheKey -> { lat, lon, lang, promise }

let hydrated = false;
let hydratePromise = null;
let idbDisabled = false;
let dbPromise = null;

const pendingPuts = new Map(); // cacheKey -> entry
const pendingDeletes = new Set(); // Set<cacheKey>
let flushTimer = null;
let activeFlushPromise = null;

let activeNetworkCount = 0;
const concurrencyWaitQueue = [];

/**
 * Kiểm tra tọa độ có hợp lệ để reverse geocode hay không.
 * Loại bỏ null/NaN, ngoài biên [-90..90] / [-180..180] và vùng nhiễu GPS (0, 0).
 */
export function isValidGeocodeCoord(lat, lon) {
    if (lat == null || lon == null || lat === '' || lon === '') return false;
    const latNum = Number(lat);
    const lonNum = Number(lon);
    if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) return false;
    if (Math.abs(latNum) > 90 || Math.abs(lonNum) > 180) return false;
    if (Math.abs(latNum) < 0.0001 && Math.abs(lonNum) < 0.0001) return false;
    return true;
}

export function normalizeGeocodeLang(opts = {}) {
    const isEn = Boolean(opts.isEn || opts.lang === 'en');
    return opts.lang || (isEn ? 'en' : 'vi');
}

export function getCoordCacheKey(lat, lon, lang = 'vi') {
    return `${lang}:${Number(lat).toFixed(4)},${Number(lon).toFixed(4)}`;
}

function getCellCoords(lat, lon) {
    return {
        cLat: Math.floor(lat / CELL_DEG),
        cLon: Math.floor(lon / CELL_DEG),
    };
}

function getCellKey(lang, cLat, cLon) {
    return `${lang}:${cLat}:${cLon}`;
}

function removeEntryFromMemory(key) {
    const existing = memoryCache.get(key);
    if (!existing) return;
    memoryCache.delete(key);

    const { cLat, cLon } = getCellCoords(existing.lat, existing.lon);
    const cellKey = getCellKey(existing.lang, cLat, cLon);
    const bucket = spatialIndex.get(cellKey);
    if (bucket) {
        bucket.delete(key);
        if (bucket.size === 0) spatialIndex.delete(cellKey);
    }
}

function insertEntryIntoMemory(entry, { trackDeleteOnEvict = true } = {}) {
    if (!entry || !entry.key || !entry.address) return;

    if (memoryCache.has(entry.key)) {
        removeEntryFromMemory(entry.key);
    }

    while (memoryCache.size >= MAX_ADDRESS_CACHE_ENTRIES) {
        const oldestKey = memoryCache.keys().next().value;
        if (!oldestKey) break;
        removeEntryFromMemory(oldestKey);
        if (trackDeleteOnEvict) {
            pendingPuts.delete(oldestKey);
            pendingDeletes.add(oldestKey);
        }
    }

    memoryCache.set(entry.key, entry);
    const { cLat, cLon } = getCellCoords(entry.lat, entry.lon);
    const cellKey = getCellKey(entry.lang, cLat, cLon);
    let bucket = spatialIndex.get(cellKey);
    if (!bucket) {
        bucket = new Set();
        spatialIndex.set(cellKey, bucket);
    }
    bucket.add(entry.key);
}

function openAddressDb() {
    if (idbDisabled) return Promise.resolve(null);
    const idb = typeof globalThis !== 'undefined' ? globalThis.indexedDB : null;
    if (!idb || typeof idb.open !== 'function') {
        idbDisabled = true;
        return Promise.resolve(null);
    }

    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve) => {
        try {
            const req = idb.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
                    store.createIndex('lastUsedAt', 'lastUsedAt', { unique: false });
                }
            };
            req.onsuccess = () => {
                const db = req.result;
                db.onversionchange = () => {
                    try {
                        db.close();
                    } catch {
                        // ignore close error
                    }
                    dbPromise = null;
                };
                resolve(db);
            };
            req.onerror = () => {
                idbDisabled = true;
                dbPromise = null;
                resolve(null);
            };
            req.onblocked = () => {
                resolve(null);
            };
        } catch {
            idbDisabled = true;
            dbPromise = null;
            resolve(null);
        }
    });

    return dbPromise;
}

function scheduleFlushToIdb() {
    if (idbDisabled || flushTimer) return;
    if (!pendingPuts.size && !pendingDeletes.size) return;

    flushTimer = setTimeout(() => {
        flushTimer = null;
        void flushAddressCacheWrites();
    }, 50);
}

/**
 * Đẩy các thay đổi cache đang chờ xuống IndexedDB theo batch transaction.
 */
export async function flushAddressCacheWrites() {
    if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
    }

    if (activeFlushPromise) {
        await activeFlushPromise;
    }

    if (idbDisabled || (!pendingPuts.size && !pendingDeletes.size)) {
        return;
    }

    const putsSnapshot = Array.from(pendingPuts.values());
    const deletesSnapshot = Array.from(pendingDeletes.values());
    pendingPuts.clear();
    pendingDeletes.clear();

    activeFlushPromise = (async () => {
        const db = await openAddressDb();
        if (!db) return;

        await new Promise((resolve) => {
            try {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);

                for (const key of deletesSnapshot) {
                    store.delete(key);
                }
                for (const entry of putsSnapshot) {
                    store.put(entry);
                }

                tx.oncomplete = () => resolve();
                tx.onerror = () => resolve();
                tx.onabort = () => resolve();
            } catch {
                resolve();
            }
        });
    })();

    try {
        await activeFlushPromise;
    } finally {
        activeFlushPromise = null;
    }

    if (pendingPuts.size || pendingDeletes.size) {
        scheduleFlushToIdb();
    }
}

function queueIdbPut(entry) {
    if (idbDisabled) return;
    pendingDeletes.delete(entry.key);
    pendingPuts.set(entry.key, entry);
    scheduleFlushToIdb();
}

function queueIdbDelete(key) {
    if (idbDisabled) return;
    pendingPuts.delete(key);
    pendingDeletes.add(key);
    scheduleFlushToIdb();
}

/**
 * Nạp dữ liệu từ IndexedDB lên L1 memory cache đúng 1 lần mỗi phiên tab.
 */
export function ensureAddressCacheHydrated() {
    if (hydrated) return Promise.resolve();
    if (hydratePromise) return hydratePromise;

    hydratePromise = (async () => {
        try {
            const db = await openAddressDb();
            if (!db) {
                hydrated = true;
                return;
            }

            const records = await new Promise((resolve) => {
                try {
                    const tx = db.transaction(STORE_NAME, 'readonly');
                    const store = tx.objectStore(STORE_NAME);
                    const req = store.getAll();
                    req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
                    req.onerror = () => resolve([]);
                } catch {
                    resolve([]);
                }
            });

            const now = Date.now();
            const valid = [];

            for (const rec of records) {
                if (!rec || !rec.key || !rec.address || !isValidGeocodeCoord(rec.lat, rec.lon)) {
                    if (rec?.key) queueIdbDelete(rec.key);
                    continue;
                }
                const updatedAt = Number(rec.updatedAt) || 0;
                if (now - updatedAt > ADDRESS_CACHE_TTL_MS) {
                    queueIdbDelete(rec.key);
                    continue;
                }
                valid.push(rec);
            }

            // Cũ nhất trước để khi vượt MAX_ADDRESS_CACHE_ENTRIES sẽ giữ lại các điểm mới dùng nhất
            valid.sort((a, b) => (a.lastUsedAt || a.updatedAt || 0) - (b.lastUsedAt || b.updatedAt || 0));

            const overflowCount = Math.max(0, valid.length - MAX_ADDRESS_CACHE_ENTRIES);
            for (let i = 0; i < overflowCount; i++) {
                queueIdbDelete(valid[i].key);
            }

            for (let i = overflowCount; i < valid.length; i++) {
                const rec = valid[i];
                const existing = memoryCache.get(rec.key);
                if (existing && (existing.updatedAt || 0) >= (rec.updatedAt || 0)) {
                    continue;
                }
                insertEntryIntoMemory(rec, { trackDeleteOnEvict: true });
            }

            hydrated = true;
            if (pendingDeletes.size > 0) {
                scheduleFlushToIdb();
            }
        } catch {
            hydrated = true;
        }
    })();

    return hydratePromise;
}

function touchCacheEntry(entry) {
    const now = Date.now();
    const shouldSyncIdb = now - (entry.lastUsedAt || 0) > TOUCH_IDB_MIN_INTERVAL_MS;
    if (shouldSyncIdb) {
        entry.lastUsedAt = now;
        queueIdbPut(entry);
    }
    // Đẩy key về cuối Map (MRU)
    memoryCache.delete(entry.key);
    memoryCache.set(entry.key, entry);
}

function lookupMemoryAddress(lat, lon, lang) {
    const now = Date.now();
    const exactKey = getCoordCacheKey(lat, lon, lang);
    const exact = memoryCache.get(exactKey);

    if (exact) {
        if (now - exact.updatedAt <= ADDRESS_CACHE_TTL_MS) {
            touchCacheEntry(exact);
            return {
                address: exact.address,
                deprecatedAddress: exact.deprecatedAddress || '',
            };
        }
        removeEntryFromMemory(exactKey);
        queueIdbDelete(exactKey);
    }

    // Kiểm tra 9 ô lân cận (3x3) trong bán kính PROXIMITY_RADIUS_METERS (~25m)
    const { cLat, cLon } = getCellCoords(lat, lon);
    let bestEntry = null;
    let bestDist = Infinity;

    for (let dLat = -1; dLat <= 1; dLat++) {
        for (let dLon = -1; dLon <= 1; dLon++) {
            const bucket = spatialIndex.get(getCellKey(lang, cLat + dLat, cLon + dLon));
            if (!bucket) continue;

            for (const candidateKey of bucket) {
                const candidate = memoryCache.get(candidateKey);
                if (!candidate) continue;

                if (now - candidate.updatedAt > ADDRESS_CACHE_TTL_MS) {
                    removeEntryFromMemory(candidateKey);
                    queueIdbDelete(candidateKey);
                    continue;
                }

                const dist = getDistanceMeters(lat, lon, candidate.lat, candidate.lon);
                if (dist != null && dist <= PROXIMITY_RADIUS_METERS && dist < bestDist) {
                    bestDist = dist;
                    bestEntry = candidate;
                }
            }
        }
    }

    if (bestEntry) {
        touchCacheEntry(bestEntry);
        return {
            address: bestEntry.address,
            deprecatedAddress: bestEntry.deprecatedAddress || '',
        };
    }

    return null;
}

/**
 * Đọc nhanh L1 memory cache theo tọa độ & bán kính lân cận (~25m), không block UI.
 * Đồng thời kích hoạt hydrate ngầm từ IndexedDB nếu chưa chạy.
 */
export function getCachedAddressSync(lat, lon, opts = {}) {
    if (!isValidGeocodeCoord(lat, lon)) return null;
    void ensureAddressCacheHydrated();
    const lang = normalizeGeocodeLang(opts);
    return lookupMemoryAddress(Number(lat), Number(lon), lang);
}

export function saveAddressToCache(lat, lon, lang, result) {
    if (!result || !result.address || !isValidGeocodeCoord(lat, lon)) return result;

    const latNum = Number(lat);
    const lonNum = Number(lon);
    const now = Date.now();
    const key = getCoordCacheKey(latNum, lonNum, lang);

    const entry = {
        key,
        lang,
        lat: latNum,
        lon: lonNum,
        address: result.address,
        deprecatedAddress: result.deprecatedAddress || '',
        updatedAt: now,
        lastUsedAt: now,
    };

    negativeCache.delete(key);
    insertEntryIntoMemory(entry, { trackDeleteOnEvict: true });
    queueIdbPut(entry);

    return {
        address: entry.address,
        deprecatedAddress: entry.deprecatedAddress,
    };
}

function isNegativeCached(key) {
    const expiresAt = negativeCache.get(key);
    if (!expiresAt) return false;
    if (Date.now() <= expiresAt) return true;
    negativeCache.delete(key);
    return false;
}

function markNegativeCache(key) {
    if (negativeCache.size >= MAX_NEGATIVE_ENTRIES) {
        const oldestKey = negativeCache.keys().next().value;
        if (oldestKey) negativeCache.delete(oldestKey);
    }
    negativeCache.set(key, Date.now() + ADDRESS_NEGATIVE_TTL_MS);
}

async function runWithConcurrency(task) {
    if (activeNetworkCount >= MAX_CONCURRENT_GEOCODE_REQUESTS) {
        await new Promise((resolve) => concurrencyWaitQueue.push(resolve));
    }
    activeNetworkCount++;
    try {
        return await task();
    } finally {
        activeNetworkCount--;
        const next = concurrencyWaitQueue.shift();
        if (next) next();
    }
}

function findNearbyInflight(lat, lon, lang, exactKey) {
    const direct = inflightRequests.get(exactKey);
    if (direct) return direct.promise;

    let closest = null;
    let closestDist = Infinity;

    for (const item of inflightRequests.values()) {
        if (item.lang !== lang) continue;
        const dist = getDistanceMeters(lat, lon, item.lat, item.lon);
        if (dist != null && dist <= PROXIMITY_RADIUS_METERS && dist < closestDist) {
            closestDist = dist;
            closest = item;
        }
    }

    return closest ? closest.promise : null;
}

/**
 * Điều phối lookup địa chỉ qua L1 memory -> IndexedDB -> in-flight dedupe -> negative cooldown -> concurrency queue.
 */
export function resolveAddressWithCache(lat, lon, opts = {}, networkFetcher) {
    if (!isValidGeocodeCoord(lat, lon)) {
        return Promise.resolve(null);
    }

    const latNum = Number(lat);
    const lonNum = Number(lon);
    const lang = normalizeGeocodeLang(opts);
    const exactKey = getCoordCacheKey(latNum, lonNum, lang);

    if (hydrated) {
        const syncHit = lookupMemoryAddress(latNum, lonNum, lang);
        if (syncHit) return Promise.resolve(syncHit);
    }

    const inflightPromise = findNearbyInflight(latNum, lonNum, lang, exactKey);
    if (inflightPromise) return inflightPromise;

    const promise = (async () => {
        try {
            await ensureAddressCacheHydrated();

            const memHit = lookupMemoryAddress(latNum, lonNum, lang);
            if (memHit) return memHit;

            if (isNegativeCached(exactKey)) return null;

            return await runWithConcurrency(async () => {
                // Kiểm tra lại sau khi qua hàng đợi phòng trường hợp request lân cận vừa resolve xong
                const afterQueueHit = lookupMemoryAddress(latNum, lonNum, lang);
                if (afterQueueHit) return afterQueueHit;

                if (isNegativeCached(exactKey)) return null;

                const fresh = await networkFetcher(latNum, lonNum, lang);
                if (fresh && fresh.address) {
                    return saveAddressToCache(latNum, lonNum, lang, fresh);
                }

                markNegativeCache(exactKey);
                return null;
            });
        } finally {
            inflightRequests.delete(exactKey);
        }
    })();

    inflightRequests.set(exactKey, {
        lat: latNum,
        lon: lonNum,
        lang,
        promise,
    });

    return promise;
}

/**
 * Helper dùng trong unit test để reset toàn bộ trạng thái cache trong module.
 */
export function __resetAddressCacheForTests() {
    if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
    }
    memoryCache.clear();
    spatialIndex.clear();
    negativeCache.clear();
    inflightRequests.clear();
    pendingPuts.clear();
    pendingDeletes.clear();
    concurrencyWaitQueue.length = 0;
    activeNetworkCount = 0;
    hydrated = false;
    hydratePromise = null;
    idbDisabled = false;
    dbPromise = null;
    activeFlushPromise = null;
}

export function __getAddressCacheStats() {
    return {
        memorySize: memoryCache.size,
        spatialBuckets: spatialIndex.size,
        negativeSize: negativeCache.size,
        inflightSize: inflightRequests.size,
        hydrated,
    };
}

