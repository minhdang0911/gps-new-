'use client';

import useSWR, { mutate } from 'swr';
import { getDeviceCategories, getMadeInFromOptions } from '../lib/api/deviceCategory';
import { getVehicleCategories, getManufacturerOptions } from '../lib/api/vehicleCategory';
import { getUserList } from '../lib/api/user';

// Bộ nhớ đệm RAM toàn cục (global window cache) với TTL 3 phút
// Đảm bảo không bị reset khi render lại component nhưng vẫn cập nhật dữ liệu mới kịp thời
const CACHE_TTL_MS = 3 * 60 * 1000;

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
    if (!force && entry.data && entry.timestamp > 0 && (now - entry.timestamp < CACHE_TTL_MS)) {
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
                if (cache.deviceCategories) {
                    cache.deviceCategories.timestamp = 0;
                    cache.deviceCategories.data = null;
                }
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
                if (cache.vehicleCategories) {
                    cache.vehicleCategories.timestamp = 0;
                    cache.vehicleCategories.data = null;
                }
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
                if (cache.userOptions) {
                    cache.userOptions.timestamp = 0;
                    cache.userOptions.data = null;
                }
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
                if (cache.manufacturers) {
                    cache.manufacturers.timestamp = 0;
                    cache.manufacturers.data = null;
                }
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
                if (cache.madeInFrom) {
                    cache.madeInFrom.timestamp = 0;
                    cache.madeInFrom.data = null;
                }
            }
            return mutateMIF();
        },
    };
}

// Invalidate specific cache (khi tạo mới / sửa / xóa) và revalidate ngay lập tức
export const invalidateMasterCache = (type) => {
    const cache = getGlobalCache();
    if (type && cache[type]) {
        cache[type].timestamp = 0;
        cache[type].data = null;
    }
    const masterKeyMap = {
        deviceCategories: MASTER_KEYS.DEVICE_CATEGORIES,
        vehicleCategories: MASTER_KEYS.VEHICLE_CATEGORIES,
        userOptions: MASTER_KEYS.USER_OPTIONS,
        manufacturers: MASTER_KEYS.MANUFACTURERS,
        madeInFrom: MASTER_KEYS.MADE_IN_FROM,
    };
    if (type && masterKeyMap[type]) {
        // Đồng bộ các tab khác qua localStorage event
        if (typeof window !== 'undefined' && window.localStorage) {
            try {
                localStorage.setItem('master_cache_invalidated', JSON.stringify({ type, t: Date.now() }));
            } catch (_) {}
        }
        return mutate(masterKeyMap[type]);
    }
};

// Lắng nghe tín hiệu đồng bộ giữa các tab trình duyệt
if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
        if (e.key === 'master_cache_invalidated' && e.newValue) {
            try {
                const { type } = JSON.parse(e.newValue);
                const cache = getGlobalCache();
                if (type && cache[type]) {
                    cache[type].timestamp = 0;
                    cache[type].data = null;
                }
                const masterKeyMap = {
                    deviceCategories: MASTER_KEYS.DEVICE_CATEGORIES,
                    vehicleCategories: MASTER_KEYS.VEHICLE_CATEGORIES,
                    userOptions: MASTER_KEYS.USER_OPTIONS,
                    manufacturers: MASTER_KEYS.MANUFACTURERS,
                    madeInFrom: MASTER_KEYS.MADE_IN_FROM,
                };
                if (type && masterKeyMap[type]) {
                    mutate(masterKeyMap[type]);
                }
            } catch (_) {}
        }
    });
}

// Làm mới toàn bộ cache
export const refreshAllMasterData = async () => {
    const cache = getGlobalCache();
    Object.keys(cache).forEach((k) => {
        if (cache[k]) {
            cache[k].timestamp = 0;
            cache[k].data = null;
        }
    });
    return Promise.allSettled(Object.values(MASTER_KEYS).map((k) => mutate(k)));
};
