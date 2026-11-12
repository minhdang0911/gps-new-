jest.mock('../mongodb', () => ({
    isMongoConfigured: jest.fn(() => true),
    getAddressCollection: jest.fn(),
}));

jest.mock('../../address/providers', () => ({
    fetchAddressFromProviders: jest.fn(),
}));

import { getAddressCollection, isMongoConfigured } from '../mongodb';
import { fetchAddressFromProviders } from '../../address/providers';
import {
    resolveOrFetchServerAddress,
    resolveBatchServerAddresses,
} from '../addressStore';
import { getCoordCacheKey } from '../../address/addressCache';

describe('server addressStore (MongoDB layer)', () => {
    beforeEach(() => {
        isMongoConfigured.mockReturnValue(true);
        jest.clearAllMocks();
    });

    test('returns configured:false gracefully when MONGODB_URI is not set', async () => {
        isMongoConfigured.mockReturnValue(false);
        const res = await resolveOrFetchServerAddress(10.75, 106.61, { lang: 'vi' });
        expect(res).toEqual({ configured: false, data: null });
        expect(fetchAddressFromProviders).not.toHaveBeenCalled();
    });

    test('hits exact Mongo key without calling Goong providers', async () => {
        const mockCol = {
            findOne: jest.fn().mockResolvedValueOnce({
                address: 'Quận 1, TP.HCM',
                deprecatedAddress: 'Phường Bến Nghé cũ',
            }),
            updateOne: jest.fn(),
        };
        getAddressCollection.mockResolvedValue(mockCol);

        const res = await resolveOrFetchServerAddress(10.77, 106.7, { lang: 'vi' });
        expect(res).toEqual({
            configured: true,
            data: {
                address: 'Quận 1, TP.HCM',
                deprecatedAddress: 'Phường Bến Nghé cũ',
                source: 'mongo',
            },
        });
        expect(fetchAddressFromProviders).not.toHaveBeenCalled();
    });

    test('hits 2dsphere nearby Mongo record when exact key misses', async () => {
        const mockCol = {
            findOne: jest
                .fn()
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce({
                    address: 'Gần Ngã 4 Hàng Xanh',
                    deprecatedAddress: '',
                }),
            updateOne: jest.fn(),
        };
        getAddressCollection.mockResolvedValue(mockCol);

        const res = await resolveOrFetchServerAddress(10.8012, 106.7113, { lang: 'vi' });
        expect(res.data).toEqual({
            address: 'Gần Ngã 4 Hàng Xanh',
            deprecatedAddress: '',
            source: 'mongo-nearby',
        });
        expect(mockCol.findOne).toHaveBeenCalledTimes(2);
        expect(fetchAddressFromProviders).not.toHaveBeenCalled();
    });

    test('deduplicates concurrent server misses, calls provider once, and persists GeoJSON Point', async () => {
        const mockCol = {
            findOne: jest.fn().mockResolvedValue(null),
            updateOne: jest.fn().mockResolvedValue({ upsertedCount: 1 }),
        };
        getAddressCollection.mockResolvedValue(mockCol);
        fetchAddressFromProviders.mockImplementation(async () => {
            await new Promise((r) => setTimeout(r, 15));
            return { address: 'Số 10 Phổ Quang', deprecatedAddress: '' };
        });

        const [r1, r2, r3] = await Promise.all([
            resolveOrFetchServerAddress(10.805, 106.665, { lang: 'vi' }),
            resolveOrFetchServerAddress(10.805, 106.665, { lang: 'vi' }),
            resolveOrFetchServerAddress(10.805, 106.665, { lang: 'vi' }),
        ]);

        expect(r1.data.address).toBe('Số 10 Phổ Quang');
        expect(r2.data.address).toBe('Số 10 Phổ Quang');
        expect(r3.data.address).toBe('Số 10 Phổ Quang');
        expect(fetchAddressFromProviders).toHaveBeenCalledTimes(1);
        expect(mockCol.updateOne).toHaveBeenCalledTimes(1);

        const [, updateDoc] = mockCol.updateOne.mock.calls[0];
        expect(updateDoc.$set.location).toEqual({
            type: 'Point',
            coordinates: [106.665, 10.805],
        });
    });

    test('resolveBatchServerAddresses queries MongoDB with $in and only fetches missing items', async () => {
        const keyHit = getCoordCacheKey(10.71, 106.61, 'vi');
        const keyMiss = getCoordCacheKey(10.72, 106.62, 'vi');

        const mockCol = {
            find: jest.fn(() => ({
                toArray: jest.fn().mockResolvedValue([
                    { key: keyHit, address: 'Địa chỉ từ bulk $in', deprecatedAddress: '' },
                ]),
            })),
            findOne: jest.fn().mockResolvedValue(null),
            updateOne: jest.fn().mockResolvedValue({ upsertedCount: 1 }),
        };
        getAddressCollection.mockResolvedValue(mockCol);
        fetchAddressFromProviders.mockResolvedValue({
            address: 'Địa chỉ mới lấy từ Goong',
            deprecatedAddress: '',
        });

        const res = await resolveBatchServerAddresses([
            { lat: 10.71, lon: 106.61, lang: 'vi' },
            { lat: 10.72, lon: 106.62, lang: 'vi' },
            { lat: 0, lon: 0, lang: 'vi' },
        ]);

        expect(res.configured).toBe(true);
        expect(res.results[keyHit].address).toBe('Địa chỉ từ bulk $in');
        expect(res.results[keyMiss].address).toBe('Địa chỉ mới lấy từ Goong');
        expect(fetchAddressFromProviders).toHaveBeenCalledTimes(1);
    });

    test('resolveBatchServerAddresses skips provider calls when resolveMissing is false', async () => {
        const keyHit = getCoordCacheKey(10.71, 106.61, 'vi');
        const keyMiss = getCoordCacheKey(10.72, 106.62, 'vi');

        const mockCol = {
            find: jest.fn(() => ({
                toArray: jest.fn().mockResolvedValue([
                    { key: keyHit, address: 'Chỉ lấy từ Mongo', deprecatedAddress: '' },
                ]),
            })),
            findOne: jest.fn().mockResolvedValue(null),
            updateOne: jest.fn(),
        };
        getAddressCollection.mockResolvedValue(mockCol);

        const res = await resolveBatchServerAddresses(
            [
                { lat: 10.71, lon: 106.61, lang: 'vi' },
                { lat: 10.72, lon: 106.62, lang: 'vi' },
            ],
            { resolveMissing: false },
        );

        expect(res.configured).toBe(true);
        expect(res.results[keyHit].address).toBe('Chỉ lấy từ Mongo');
        expect(res.results[keyMiss]).toBeUndefined();
        expect(fetchAddressFromProviders).not.toHaveBeenCalled();
    });
});

