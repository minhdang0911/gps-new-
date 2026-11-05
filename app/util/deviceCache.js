// util/deviceCache.js
'use client';

const CACHE_KEY = 'iky_devices_cache_v1';
const CACHE_TS_KEY = 'iky_devices_ts_v1';

let _memoryCache = null;

/**
 * Lấy danh sách thiết bị từ cache đồng bộ (in-memory hoặc localStorage)
 * Trả về mảng thiết bị ngay lập tức (< 1ms), không bị block bởi Promise.
 */
export function getCachedDevices() {
    if (_memoryCache && Array.isArray(_memoryCache) && _memoryCache.length > 0) {
        return _memoryCache;
    }
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                _memoryCache = parsed;
                return parsed;
            }
        }
    } catch {
        // ignore parse error
    }
    return [];
}

/**
 * Lưu danh sách thiết bị vào cache (in-memory và localStorage)
 */
export function setCachedDevices(devices) {
    if (!Array.isArray(devices) || !devices.length) return;
    _memoryCache = devices;
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(devices));
        localStorage.setItem(CACHE_TS_KEY, String(Date.now()));
    } catch {
        // ignore quota error
    }
}

/**
 * Thêm mới hoặc cập nhật 1 thiết bị vào cache ngay lập tức
 * (được gọi sau khi tạo mới / cập nhật thiết bị ở Manage Devices)
 */
export function addOrUpdateDeviceInCache(device) {
    if (!device || !device._id) return;
    const current = getCachedDevices();
    const idx = current.findIndex((d) => d._id === device._id);
    let next;
    if (idx >= 0) {
        next = [...current];
        next[idx] = { ...next[idx], ...device };
    } else {
        next = [device, ...current];
    }
    setCachedDevices(next);
}

/**
 * Xóa 1 thiết bị khỏi cache ngay lập tức
 * (được gọi sau khi xóa thiết bị ở Manage Devices)
 */
export function removeDeviceFromCache(deviceId) {
    if (!deviceId) return;
    const current = getCachedDevices();
    const next = current.filter((d) => d._id !== deviceId);
    setCachedDevices(next);
}

/**
 * Xóa cache thiết bị (khi đăng xuất)
 */
export function clearDeviceCache() {
    _memoryCache = null;
    if (typeof window === 'undefined') return;
    try {
        localStorage.removeItem(CACHE_KEY);
        localStorage.removeItem(CACHE_TS_KEY);
    } catch {
        // ignore
    }
}
