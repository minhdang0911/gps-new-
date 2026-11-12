jest.mock('../keys', () => ({
    GOONG_KEYS: ['key-1', 'key-2', 'key-3'],
    VIETMAP_KEYS: [],
    MAPBOX_TOKEN: '',
    TOMTOM_TOKEN: '',
    TRACKASIA_KEY: '',
    OPENCAGE_KEY: '',
    MAP4D_KEY: '',
    getCurrentGoongKey: jest.fn(),
    moveToNextGoongKey: jest.fn(),
}));

import {
    getCurrentGoongKey,
    moveToNextGoongKey,
} from '../keys';
import {
    __resetAddressCacheForTests,
    flushAddressCacheWrites,
} from '../addressCache';
import {
    reverseGeocodeAddress,
    reverseGeocodeBatch,
    getCachedAddressSync,
    callGoongWithRotation,
    isValidGeocodeCoord,
    getCoordCacheKey,
    __resetServerApiBackoffForTests,
} from '../reverseGeocode';

function createMockIndexedDB(backingStore = new Map()) {
    const makeRequest = (executor) => {
        const req = { result: undefined, onsuccess: null, onerror: null, onupgradeneeded: null };
        queueMicrotask(() => executor(req));
        return req;
    };

    const storeApi = {
        createIndex: jest.fn(),
        getAll: () =>
            makeRequest((req) => {
                req.result = Array.from(backingStore.values()).map((v) => ({ ...v }));
                req.onsuccess?.();
            }),
        put: (val) => {
            backingStore.set(val.key, { ...val });
        },
        delete: (key) => {
            backingStore.delete(key);
        },
    };

    const dbApi = {
        objectStoreNames: { contains: () => true },
        close: jest.fn(),
        onversionchange: null,
        transaction: () => {
            const tx = {
                oncomplete: null,
                onerror: null,
                onabort: null,
                objectStore: () => storeApi,
            };
            queueMicrotask(() => tx.oncomplete?.());
            return tx;
        },
    };

    return {
        open: () =>
            makeRequest((req) => {
                req.result = dbApi;
                req.onsuccess?.();
            }),
    };
}

describe('reverseGeocode & addressCache', () => {
    let originalFetch;
    let originalIndexedDB;

    beforeEach(() => {
        originalFetch = global.fetch;
        originalIndexedDB = globalThis.indexedDB;
        globalThis.indexedDB = undefined;
        __resetAddressCacheForTests();
        __resetServerApiBackoffForTests();

        let keyIdx = 0;
        const keys = ['key-1', 'key-2', 'key-3'];
        getCurrentGoongKey.mockImplementation(() => keys[keyIdx % keys.length]);
        moveToNextGoongKey.mockImplementation(() => {
            keyIdx += 1;
        });
    });

    afterEach(() => {
        global.fetch = originalFetch;
        globalThis.indexedDB = originalIndexedDB;
        jest.clearAllMocks();
    });

    test('rejects invalid and (0,0) coordinates without calling fetch', async () => {
        const fetchMock = jest.fn();
        global.fetch = fetchMock;

        expect(isValidGeocodeCoord(0, 0)).toBe(false);
        expect(isValidGeocodeCoord('', 106.6)).toBe(false);
        expect(isValidGeocodeCoord(95, 106.6)).toBe(false);
        expect(isValidGeocodeCoord(10.754, 106.617)).toBe(true);

        expect(await reverseGeocodeAddress(0, 0, { skipServerApi: true })).toBeNull();
        expect(await reverseGeocodeAddress(null, 106.6, { skipServerApi: true })).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    test('callGoongWithRotation stops immediately on HTTP 200 empty results instead of burning all keys', async () => {
        const fetchMock = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ status: 'OK', results: [] }),
        });
        global.fetch = fetchMock;

        const res = await callGoongWithRotation(10.754, 106.617, 'vi');
        expect(res).toBeNull();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(moveToNextGoongKey).not.toHaveBeenCalled();
    });

    test('callGoongWithRotation rotates keys on 429 and succeeds on next key', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce({ ok: false, status: 429 })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    results: [{ formatted_address: '123 Đường ABC, TP.HCM' }],
                }),
            });
        global.fetch = fetchMock;

        const res = await callGoongWithRotation(10.754, 106.617, 'vi');
        expect(res).toEqual({
            address: '123 Đường ABC, TP.HCM',
            deprecatedAddress: '',
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(moveToNextGoongKey).toHaveBeenCalledTimes(1);
    });

    test('uses 25m spatial memory cache and separates cache by language', async () => {
        const fetchMock = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                results: [{ formatted_address: 'Chợ Bến Thành, Q1' }],
            }),
        });
        global.fetch = fetchMock;

        const first = await reverseGeocodeAddress(10.7721, 106.6983, {
            lang: 'vi',
            skipServerApi: true,
        });
        expect(first.address).toBe('Chợ Bến Thành, Q1');
        expect(fetchMock).toHaveBeenCalledTimes(1);

        // ~12m away -> phải hit L1 spatial cache, 0 network calls
        const nearby = await reverseGeocodeAddress(10.77218, 106.69838, {
            lang: 'vi',
            skipServerApi: true,
        });
        expect(nearby.address).toBe('Chợ Bến Thành, Q1');
        expect(fetchMock).toHaveBeenCalledTimes(1);

        // Đọc sync helper trả ngay lập tức
        expect(getCachedAddressSync(10.77218, 106.69838, { lang: 'vi' })).toEqual({
            address: 'Chợ Bến Thành, Q1',
            deprecatedAddress: '',
        });

        // Đổi sang lang='en' -> không dùng nhầm cache 'vi'
        await reverseGeocodeAddress(10.7721, 106.6983, {
            lang: 'en',
            skipServerApi: true,
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    test('persists to IndexedDB and hydrates cleanly after L1 memory reset', async () => {
        const idbStore = new Map();
        globalThis.indexedDB = createMockIndexedDB(idbStore);

        const fetchMock = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                results: [{ formatted_address: 'Sân bay Tân Sơn Nhất' }],
            }),
        });
        global.fetch = fetchMock;

        const res1 = await reverseGeocodeAddress(10.8185, 106.6588, {
            lang: 'vi',
            skipServerApi: true,
        });
        expect(res1.address).toBe('Sân bay Tân Sơn Nhất');
        await flushAddressCacheWrites();
        expect(idbStore.size).toBe(1);

        // Giả lập F5 reload: reset hoàn toàn RAM L1, chỉ giữ IndexedDB backing store
        __resetAddressCacheForTests();
        globalThis.indexedDB = createMockIndexedDB(idbStore);

        const res2 = await reverseGeocodeAddress(10.81855, 106.65885, {
            lang: 'vi',
            skipServerApi: true,
        });
        expect(res2.address).toBe('Sân bay Tân Sơn Nhất');
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test('deduplicates concurrent in-flight calls and bounds concurrency <= 4', async () => {
        let active = 0;
        let maxActive = 0;

        const fetchMock = jest.fn(async (url) => {
            active += 1;
            maxActive = Math.max(maxActive, active);
            await new Promise((r) => setTimeout(r, 15));
            active -= 1;
            if (String(url).includes('goong')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        results: [{ formatted_address: `Addr ${url}` }],
                    }),
                };
            }
            return { ok: false, status: 404 };
        });
        global.fetch = fetchMock;

        // 5 call trùng / sát nhau -> chỉ 1 call Goong
        const sameSpotPromises = Array.from({ length: 5 }, (_, i) =>
            reverseGeocodeAddress(10.7 + i * 0.00001, 106.6, {
                lang: 'vi',
                skipServerApi: true,
            }),
        );
        await Promise.all(sameSpotPromises);
        expect(fetchMock).toHaveBeenCalledTimes(1);

        // 8 điểm cách xa nhau -> concurrency tối đa <= 4
        fetchMock.mockClear();
        const farPromises = Array.from({ length: 8 }, (_, i) =>
            reverseGeocodeAddress(11.0 + i * 0.1, 106.6, {
                lang: 'vi',
                skipServerApi: true,
            }),
        );
        await Promise.all(farPromises);
        expect(maxActive).toBeLessThanOrEqual(4);
    });

    test('reverseGeocodeBatch only sends uncached coords to /api/geocode/batch and caches results', async () => {
        const key1 = getCoordCacheKey(10.71, 106.61, 'vi');
        const key2 = getCoordCacheKey(10.72, 106.62, 'vi');

        const fetchMock = jest.fn(async (url, init) => {
            if (url === '/api/geocode/reverse') {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        configured: true,
                        address: 'Điểm 1 đã cache',
                        deprecatedAddress: '',
                    }),
                };
            }
            if (url === '/api/geocode/batch') {
                const body = JSON.parse(init.body);
                expect(body.items).toEqual([{ lat: 10.72, lon: 106.62, lang: 'vi' }]);
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        configured: true,
                        results: {
                            [key2]: { address: 'Điểm 2 từ Mongo', deprecatedAddress: '' },
                        },
                    }),
                };
            }
            return { ok: false, status: 404 };
        });
        global.fetch = fetchMock;

        // Pre-warm key1
        await reverseGeocodeAddress(10.71, 106.61, { lang: 'vi' });

        // Batch gồm cả điểm 1 (gần 5m) + điểm 2 + điểm (0,0) lỗi
        const batch = await reverseGeocodeBatch(
            [
                { lat: 10.71003, lon: 106.61002 },
                { lat: 10.72, lon: 106.62 },
                { lat: 0, lon: 0 },
            ],
            { lang: 'vi' },
        );

        expect(batch[key1].address).toBe('Điểm 1 đã cache');
        expect(batch[key2].address).toBe('Điểm 2 từ Mongo');
        expect(getCachedAddressSync(10.72, 106.62, { lang: 'vi' })?.address).toBe('Điểm 2 từ Mongo');
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});
