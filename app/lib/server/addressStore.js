// app/lib/server/addressStore.js

import {
    PROXIMITY_RADIUS_METERS,
    getCoordCacheKey,
    isValidGeocodeCoord,
    normalizeGeocodeLang,
} from '../address/addressCache';
import { fetchAddressFromProviders } from '../address/providers';
import { getAddressCollection, isMongoConfigured } from './mongodb';

const MAX_SERVER_CONCURRENT_PROVIDER_CALLS = 4;
const serverInflightMap = new Map();
let activeProviderCalls = 0;
const providerWaitQueue = [];

async function runProviderLimited(fn) {
    if (activeProviderCalls >= MAX_SERVER_CONCURRENT_PROVIDER_CALLS) {
        await new Promise((resolve) => providerWaitQueue.push(resolve));
    }
    activeProviderCalls++;
    try {
        return await fn();
    } finally {
        activeProviderCalls--;
        const next = providerWaitQueue.shift();
        if (next) next();
    }
}

export async function findAddressInMongo(collection, latNum, lonNum, lang) {
    if (!collection) return null;

    const key = getCoordCacheKey(latNum, lonNum, lang);
    const exact = await collection.findOne(
        { key },
        { projection: { _id: 0, address: 1, deprecatedAddress: 1 } },
    );
    if (exact?.address) {
        return {
            address: exact.address,
            deprecatedAddress: exact.deprecatedAddress || '',
            source: 'mongo',
        };
    }

    try {
        const nearby = await collection.findOne(
            {
                lang,
                location: {
                    $nearSphere: {
                        $geometry: {
                            type: 'Point',
                            coordinates: [lonNum, latNum],
                        },
                        $maxDistance: PROXIMITY_RADIUS_METERS,
                    },
                },
            },
            { projection: { _id: 0, address: 1, deprecatedAddress: 1 } },
        );

        if (nearby?.address) {
            return {
                address: nearby.address,
                deprecatedAddress: nearby.deprecatedAddress || '',
                source: 'mongo-nearby',
            };
        }
    } catch (err) {
        console.warn('[addressStore] $nearSphere lookup fallback:', err?.message || err);
    }

    return null;
}

export async function saveAddressToMongo(collection, { latNum, lonNum, lang, address, deprecatedAddress = '' }) {
    if (!collection || !address) return;

    const key = getCoordCacheKey(latNum, lonNum, lang);
    const now = new Date();

    try {
        await collection.updateOne(
            { key },
            {
                $set: {
                    lang,
                    lat: latNum,
                    lon: lonNum,
                    location: {
                        type: 'Point',
                        coordinates: [lonNum, latNum],
                    },
                    address,
                    deprecatedAddress: deprecatedAddress || '',
                    updatedAt: now,
                },
                $setOnInsert: {
                    key,
                    createdAt: now,
                },
            },
            { upsert: true },
        );
    } catch (err) {
        // Bỏ qua duplicate key race hiếm gặp khi nhiều worker upsert cùng lúc
        if (err?.code !== 11000) {
            console.warn('[addressStore] Mongo save warning:', err?.message || err);
        }
    }
}

/**
 * Tra cứu địa chỉ theo 2 bước trên server:
 * 1) Tìm chính xác hoặc bán kính 25m trong MongoDB
 * 2) Nếu chưa có mới gọi Goong/fallback (có dedupe + concurrency limit), rồi lưu vĩnh viễn vào MongoDB
 */
export async function resolveOrFetchServerAddress(lat, lon, opts = {}) {
    if (!isMongoConfigured()) {
        return { configured: false, data: null };
    }

    if (!isValidGeocodeCoord(lat, lon)) {
        return { configured: true, data: null };
    }

    const latNum = Number(lat);
    const lonNum = Number(lon);
    const lang = normalizeGeocodeLang(opts);
    const key = getCoordCacheKey(latNum, lonNum, lang);

    if (serverInflightMap.has(key)) {
        const result = await serverInflightMap.get(key);
        return { configured: true, data: result };
    }

    const taskPromise = (async () => {
        const collection = await getAddressCollection();
        if (!collection) {
            throw new Error('MONGO_UNAVAILABLE');
        }

        const cached = await findAddressInMongo(collection, latNum, lonNum, lang);
        if (cached) return cached;

        return runProviderLimited(async () => {
            // Re-check phòng trường hợp request song song vừa lưu xong trong lúc đợi queue
            const recheck = await findAddressInMongo(collection, latNum, lonNum, lang);
            if (recheck) return recheck;

            const fetched = await fetchAddressFromProviders(latNum, lonNum, lang);
            if (!fetched || !fetched.address) return null;

            await saveAddressToMongo(collection, {
                latNum,
                lonNum,
                lang,
                address: fetched.address,
                deprecatedAddress: fetched.deprecatedAddress || '',
            });

            return {
                address: fetched.address,
                deprecatedAddress: fetched.deprecatedAddress || '',
                source: 'provider',
            };
        });
    })();

    serverInflightMap.set(key, taskPromise);

    try {
        const data = await taskPromise;
        return { configured: true, data };
    } finally {
        serverInflightMap.delete(key);
    }
}

/**
 * Giải mã batch nhiều tọa độ (dùng cho bảng report): $in MongoDB 1 roundtrip trước, miss mới lookup/provider.
 */
export async function resolveBatchServerAddresses(items = []) {
    if (!isMongoConfigured()) {
        return { configured: false, results: {} };
    }

    const collection = await getAddressCollection();
    if (!collection) {
        return { configured: false, results: {} };
    }

    const uniqueByKey = new Map();
    for (const item of items) {
        if (!item || !isValidGeocodeCoord(item.lat, item.lon)) continue;
        const latNum = Number(item.lat);
        const lonNum = Number(item.lon);
        const lang = normalizeGeocodeLang({ lang: item.lang, isEn: item.isEn });
        const key = getCoordCacheKey(latNum, lonNum, lang);
        if (!uniqueByKey.has(key)) {
            uniqueByKey.set(key, { key, latNum, lonNum, lang });
        }
    }

    if (uniqueByKey.size === 0) {
        return { configured: true, results: {} };
    }

    const results = {};
    const keys = Array.from(uniqueByKey.keys());

    // 1. Bulk lookup exact keys trong 1 roundtrip
    const exactDocs = await collection
        .find({ key: { $in: keys } }, { projection: { _id: 0, key: 1, address: 1, deprecatedAddress: 1 } })
        .toArray();

    for (const doc of exactDocs) {
        if (doc?.key && doc?.address) {
            results[doc.key] = {
                address: doc.address,
                deprecatedAddress: doc.deprecatedAddress || '',
                source: 'mongo',
            };
        }
    }

    // 2. Các điểm còn thiếu -> qua resolveOrFetchServerAddress (tận dụng $nearSphere + inflight + concurrency)
    const missing = Array.from(uniqueByKey.values()).filter((entry) => !results[entry.key]);

    await Promise.all(
        missing.map(async (entry) => {
            try {
                const res = await resolveOrFetchServerAddress(entry.latNum, entry.lonNum, { lang: entry.lang });
                if (res?.data?.address) {
                    results[entry.key] = res.data;
                }
            } catch {
                // ignore item error so other rows still resolve
            }
        }),
    );

    return { configured: true, results };
}

