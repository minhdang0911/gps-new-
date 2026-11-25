/**
 * @file spatialStorage.js
 * @description Lưu trữ và đọc cấu trúc chỉ mục không gian từ IndexedDB để nạp tức thì trong 15ms.
 */

import { get, set, del } from 'idb-keyval';
import { SPATIAL_STORAGE_KEY } from './spatialTypes.js';

/**
 * Đọc cấu trúc chỉ mục không gian đã tiền xử lý từ IndexedDB.
 * @returns {Promise<object|null>}
 */
export async function loadSpatialIndexFromStorage() {
    if (typeof window === 'undefined') return null;
    try {
        const cached = await get(SPATIAL_STORAGE_KEY);
        if (cached && cached.version === 1 && cached.provinces && cached.districts) {
            return cached;
        }
        return null;
    } catch (err) {
        console.warn('[SpatialStorage] Failed to read from IndexedDB:', err);
        return null;
    }
}

/**
 * Lưu cấu trúc chỉ mục không gian vào IndexedDB.
 * @param {object} spatialIndexData
 */
export async function saveSpatialIndexToStorage(spatialIndexData) {
    if (typeof window === 'undefined' || !spatialIndexData) return;
    try {
        await set(SPATIAL_STORAGE_KEY, {
            version: 1,
            timestamp: Date.now(),
            ...spatialIndexData,
        });
    } catch (err) {
        console.warn('[SpatialStorage] Failed to save to IndexedDB:', err);
    }
}

/**
 * Xóa cấu trúc chỉ mục khỏi IndexedDB nếu cần làm mới.
 */
export async function clearSpatialIndexStorage() {
    if (typeof window === 'undefined') return;
    try {
        await del(SPATIAL_STORAGE_KEY);
    } catch (err) {
        console.warn('[SpatialStorage] Failed to delete from IndexedDB:', err);
    }
}
