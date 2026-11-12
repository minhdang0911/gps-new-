// app/lib/address/reverseGeocode.js

import {
    ensureAddressCacheHydrated,
    getCachedAddressSync,
    getCoordCacheKey,
    isValidGeocodeCoord,
    normalizeGeocodeLang,
    resolveAddressWithCache,
    saveAddressToCache,
} from './addressCache';
import { fetchAddressFromProviders, pickBestGoongV2Address, callGoongWithRotation } from './providers';

export {
    getCachedAddressSync,
    getCoordCacheKey,
    isValidGeocodeCoord,
    pickBestGoongV2Address,
    callGoongWithRotation,
};

const WRITE_BATCH_CHUNK_SIZE = 8;
const READ_BATCH_CHUNK_SIZE = 30;
const SERVER_API_TIMEOUT_MS = 6500;
let serverApiSkipUntil = 0;

export function __resetServerApiBackoffForTests() {
    serverApiSkipUntil = 0;
}

async function fetchServerApi(url, payload) {
    if (typeof AbortController === 'undefined') {
        return fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SERVER_API_TIMEOUT_MS);
    try {
        return await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timer);
    }
}

async function callServerGeocodeReverse(latNum, lonNum, lang) {
    if (typeof window === 'undefined') return { handled: false, data: null };
    if (Date.now() < serverApiSkipUntil) return { handled: false, data: null };

    try {
        const res = await fetchServerApi('/api/geocode/reverse', { lat: latNum, lon: lonNum, lang });

        if (res.status === 503) {
            serverApiSkipUntil = Date.now() + 60_000;
            return { handled: false, data: null };
        }

        if (!res.ok) {
            return { handled: false, data: null };
        }

        const json = await res.json();
        if (json?.configured === false) {
            serverApiSkipUntil = Date.now() + 60_000;
            return { handled: false, data: null };
        }

        return {
            handled: true,
            data: json?.address
                ? { address: json.address, deprecatedAddress: json.deprecatedAddress || '' }
                : null,
        };
    } catch {
        return { handled: false, data: null };
    }
}

async function callServerGeocodeBatch(chunk, resolveMissing = true) {
    if (typeof window === 'undefined') return { handled: false, results: {} };
    if (Date.now() < serverApiSkipUntil) return { handled: false, results: {} };

    try {
        const res = await fetchServerApi('/api/geocode/batch', { items: chunk, resolveMissing });

        if (res.status === 503) {
            serverApiSkipUntil = Date.now() + 60_000;
            return { handled: false, results: {} };
        }

        if (!res.ok) {
            return { handled: false, results: {} };
        }

        const json = await res.json();
        if (json?.configured === false) {
            serverApiSkipUntil = Date.now() + 60_000;
            return { handled: false, results: {} };
        }

        return {
            handled: true,
            results: json?.results || {},
        };
    } catch {
        return { handled: false, results: {} };
    }
}

// ===============================
// ⭐ HÀM CHÍNH reverseGeocodeAddress (3 tầng: L1/IndexedDB -> MongoDB API -> Goong/Fallback)
// ===============================
export const reverseGeocodeAddress = async (lat, lon, opts = {}) => {
    const lang = normalizeGeocodeLang(opts);
    const isEn = Boolean(opts.isEn || lang === 'en');
    const skipServerApi = Boolean(opts.skipServerApi);

    return resolveAddressWithCache(lat, lon, { lang, isEn }, async (latNum, lonNum, resolvedLang) => {
        if (!skipServerApi) {
            const serverRes = await callServerGeocodeReverse(latNum, lonNum, resolvedLang);
            if (serverRes.handled) {
                return serverRes.data;
            }
        }

        return fetchAddressFromProviders(latNum, lonNum, resolvedLang);
    });
};

/**
 * Giải mã danh sách nhiều tọa độ: lọc trước qua L1/IndexedDB -> gọi batch API MongoDB -> fallback client nếu cần.
 * Trả về map { [coordKey]: { address, deprecatedAddress } }.
 */
export async function reverseGeocodeBatch(items = [], opts = {}) {
    const defaultLang = normalizeGeocodeLang(opts);
    const defaultIsEn = Boolean(opts.isEn || defaultLang === 'en');
    const skipServerApi = Boolean(opts.skipServerApi);
    const resolveMissing = opts.resolveMissing !== false;

    await ensureAddressCacheHydrated();

    const resultByKey = {};
    const missingMap = new Map();

    for (const item of items) {
        if (!item || !isValidGeocodeCoord(item.lat, item.lon)) continue;
        const latNum = Number(item.lat);
        const lonNum = Number(item.lon);
        const lang = normalizeGeocodeLang({ lang: item.lang || defaultLang, isEn: item.isEn ?? defaultIsEn });
        const key = getCoordCacheKey(latNum, lonNum, lang);

        if (resultByKey[key]) continue;

        const memHit = getCachedAddressSync(latNum, lonNum, { lang });
        if (memHit?.address) {
            resultByKey[key] = memHit;
            continue;
        }

        if (!missingMap.has(key)) {
            missingMap.set(key, { key, lat: latNum, lon: lonNum, lang });
        }
    }

    const missingEntries = Array.from(missingMap.values());
    if (missingEntries.length === 0) return resultByKey;

    const remainingForClient = [];
    const chunkSize = resolveMissing ? WRITE_BATCH_CHUNK_SIZE : READ_BATCH_CHUNK_SIZE;

    if (!skipServerApi && typeof window !== 'undefined') {
        for (let i = 0; i < missingEntries.length; i += chunkSize) {
            const chunk = missingEntries.slice(i, i + chunkSize);
            const batchRes = await callServerGeocodeBatch(
                chunk.map(({ lat, lon, lang }) => ({ lat, lon, lang })),
                resolveMissing,
            );

            if (!batchRes.handled) {
                if (resolveMissing) {
                    remainingForClient.push(...chunk);
                }
                continue;
            }

            for (const entry of chunk) {
                const hit = batchRes.results?.[entry.key];
                if (hit?.address) {
                    const saved = saveAddressToCache(entry.lat, entry.lon, entry.lang, hit);
                    resultByKey[entry.key] = saved;
                }
            }
        }
    } else if (resolveMissing) {
        remainingForClient.push(...missingEntries);
    }

    if (resolveMissing && remainingForClient.length > 0) {
        await Promise.all(
            remainingForClient.map(async (entry) => {
                const res = await reverseGeocodeAddress(entry.lat, entry.lon, {
                    lang: entry.lang,
                    skipServerApi: true,
                });
                if (res?.address) {
                    resultByKey[entry.key] = res;
                }
            }),
        );
    }

    return resultByKey;
}
