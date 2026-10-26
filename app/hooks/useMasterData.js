'use client';

import useSWR, { mutate } from 'swr';
import { getDeviceCategories, getMadeInFromOptions } from '../lib/api/deviceCategory';
import { getVehicleCategories, getManufacturerOptions } from '../lib/api/vehicleCategory';
import { getUserList } from '../lib/api/user';

// Bộ nhớ đệm RAM toàn cục (global window cache) với TTL 15 phút
// Đảm bảo không bị reset khi Hot-Reload hoặc render lại component
const CACHE_TTL_MS = 15 * 60 * 1000;

const getGlobalCache = () => {
    if (typeof window !== 'undefined') {
        if (!window.__MASTER_DATA_CACHE__) {
            window.__MASTER_DATA_CACHE__ = {
                deviceCategories: { data: null, timestamp: 0, inflight: null },
                vehicleCategories: { data: null, timestamp: 0, inflight: null },
                userOptions: { data: null, timestamp: 0, inflight: null },
                manufacturers: { data: null, timestamp: 0, inflight: null },
                madeInFrom: { data: null, timestamp: 0, inflight: null },
            };
        }
        return window.__MASTER_DATA_CACHE__;
    }
    return {
        deviceCategories: { data: null, timestamp: 0, inflight: null },
        vehicleCategories: { data: null, timestamp: 0, inflight: null },
        userOptions: { data: null, timestamp: 0, inflight: null },
        manufacturers: { data: null, timestamp: 0, inflight: null },
        madeInFrom: { data: null, timestamp: 0, inflight: null },
    };
};

const getCachedOrFetch = async (key, fetcher, force = false) => {
    const cache = getGlobalCache();
    const entry = cache[key] || (cache[key] = { data: null, timestamp: 0, inflight: null });
    const now = Date.now();

    // 1. Trả về RAM cache nếu còn hạn
    if (!force && entry.data && (now - entry.timestamp < CACHE_TTL_MS)) {
        return entry.data;
    }
    // 2. Chống dồn request: nếu đang có 1 request đang chạy thì dùng chung Promise
    if (entry.inflight) {
        return entry.inflight;
    }
    // 3. Thực hiện fetch từ server
    entry.inflight = (async () => {
        try {
            const data = await fetcher();
            entry.data = data;
            entry.timestamp = Date.now();
            return data;
        } finally {
            entry.inflight = null;
        }
    })();
    return entry.inflight;
};

export const MASTER_KEYS = {
    DEVICE_CATEGORIES: 'master_device_categories',
    VEHICLE_CATEGORIES: 'master_vehicle_categories',
    USER_OPTIONS: 'master_user_options',
    MANUFACTURERS: 'master_manufacturers',
    MADE_IN_FROM: 'master_made_in_from',
};

const SWR_OPTS = {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    keepPreviousData: true,
    dedupingInterval: CACHE_TTL_MS,
};

// 1. Hook Loại thiết bị
export function useMasterDeviceCategories(enabled = true) {
    const { data, isLoading, isValidating, mutate: mutateDC } = useSWR(
        enabled ? MASTER_KEYS.DEVICE_CATEGORIES : null,
        () => getCachedOrFetch('deviceCategories', () => getDeviceCategories({ limit: 1000 })),
        SWR_OPTS,
    );
    return {
        deviceCategories: data?.items || [],
        dcLoading: isLoading,
        dcValidating: isValidating,
        mutateDeviceCategories: (force = false) => {
            if (force) {
                const cache = getGlobalCache();
                if (cache.deviceCategories) cache.deviceCategories.timestamp = 0;
            }
            return mutateDC();
        },
    };
}

// 2. Hook Dòng xe
export function useMasterVehicleCategories(enabled = true) {
    const { data, isLoading, isValidating, mutate: mutateVC } = useSWR(
        enabled ? MASTER_KEYS.VEHICLE_CATEGORIES : null,
        () => getCachedOrFetch('vehicleCategories', () => getVehicleCategories({ limit: 1000 })),
        SWR_OPTS,
    );
    return {
        vehicleCategories: data?.items || [],
        vcLoading: isLoading,
        vcValidating: isValidating,
        mutateVehicleCategories: (force = false) => {
            if (force) {
                const cache = getGlobalCache();
                if (cache.vehicleCategories) cache.vehicleCategories.timestamp = 0;
            }
            return mutateVC();
        },
    };
}

// 3. Hook Khách hàng / users
export function useMasterUserOptions(enabled = true) {
    const { data, isLoading, isValidating, mutate: mutateUsers } = useSWR(
        enabled ? MASTER_KEYS.USER_OPTIONS : null,
        () => getCachedOrFetch('userOptions', () => getUserList({ limit: 2000 })),
        SWR_OPTS,
    );
    return {
        userOptions: data?.items || [],
        usersLoading: isLoading,
        usersValidating: isValidating,
        mutateUserOptions: (force = false) => {
            if (force) {
                const cache = getGlobalCache();
                if (cache.userOptions) cache.userOptions.timestamp = 0;
            }
            return mutateUsers();
        },
    };
}

// 4. Hook Hãng sản xuất xe
export function useMasterManufacturerOptions(enabled = true) {
    const { data, isLoading, isValidating, mutate: mutateManu } = useSWR(
        enabled ? MASTER_KEYS.MANUFACTURERS : null,
        () => getCachedOrFetch('manufacturers', () => getManufacturerOptions()),
        SWR_OPTS,
    );
    return {
        manufacturerRes: data || {},
        manuLoading: isLoading,
        manuValidating: isValidating,
        mutateManufacturers: (force = false) => {
            if (force) {
                const cache = getGlobalCache();
                if (cache.manufacturers) cache.manufacturers.timestamp = 0;
            }
            return mutateManu();
        },
    };
}

// 5. Hook Xuất xứ
export function useMasterMadeInFromOptions(enabled = true) {
    const { data, isLoading, isValidating, mutate: mutateMIF } = useSWR(
        enabled ? MASTER_KEYS.MADE_IN_FROM : null,
        () => getCachedOrFetch('madeInFrom', () => getMadeInFromOptions()),
        SWR_OPTS,
    );
    return {
        madeInFromRes: data || {},
        mifLoading: isLoading,
        mifValidating: isValidating,
        mutateMadeInFrom: (force = false) => {
            if (force) {
                const cache = getGlobalCache();
                if (cache.madeInFrom) cache.madeInFrom.timestamp = 0;
            }
            return mutateMIF();
        },
    };
}

// Invalidate specific cache (khi tạo mới / sửa / xóa)
export const invalidateMasterCache = (type) => {
    const cache = getGlobalCache();
    if (type && cache[type]) {
        cache[type].timestamp = 0;
    }
};

// Làm mới toàn bộ cache
export const refreshAllMasterData = async () => {
    const cache = getGlobalCache();
    Object.keys(cache).forEach((k) => {
        if (cache[k]) cache[k].timestamp = 0;
    });
    return Promise.allSettled(Object.values(MASTER_KEYS).map((k) => mutate(k)));
};
