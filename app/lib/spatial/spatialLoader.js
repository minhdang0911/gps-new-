/**
 * @file spatialLoader.js
 * @description Trình nạp đơn nhất (Singleton Loader) đảm bảo chỉ tải GeoJSON 36MB 1 lần duy nhất trong toàn hệ thống.
 */

import { VIETNAM_GEOJSON_PATH } from './spatialTypes.js';
import { buildSpatialIndex } from './spatialIndex.js';
import { loadSpatialIndexFromStorage, saveSpatialIndexToStorage } from './spatialStorage.js';

let _activeSpatialIndex = null;
let _loadingPromise = null;
let _rawGeoJsonCache = null;

/**
 * Nạp chỉ mục không gian (Lazy Loading):
 * 1. Đọc từ RAM (0ms)
 * 2. Đọc từ IndexedDB (15ms)
 * 3. Nếu chưa có: tải từ mạng, dựng chỉ mục, lưu vào IndexedDB và RAM.
 */
export async function getOrLoadSpatialIndex(onProgress) {
    if (_activeSpatialIndex) {
        return _activeSpatialIndex;
    }

    if (_loadingPromise) {
        return _loadingPromise;
    }

    _loadingPromise = (async () => {
        try {
            // Bước 1: Kiểm tra IndexedDB
            const storedIndex = await loadSpatialIndexFromStorage();
            if (storedIndex && storedIndex.provinces && storedIndex.districts) {
                // Reconstruct provinceMap
                const provinceMap = new Map();
                storedIndex.provinces.forEach((p) => provinceMap.set(String(p.id), p));
                storedIndex.provinceMap = provinceMap;
                _activeSpatialIndex = storedIndex;
                return storedIndex;
            }

            // Bước 2: Tải GeoJSON 36MB từ server nếu chưa có trong IndexedDB
            if (typeof onProgress === 'function') onProgress('downloading');
            const response = await fetch(VIETNAM_GEOJSON_PATH);
            if (!response.ok) {
                throw new Error(`Failed to load ${VIETNAM_GEOJSON_PATH}: HTTP ${response.status}`);
            }

            if (typeof onProgress === 'function') onProgress('parsing');
            const geoJson = await response.json();
            _rawGeoJsonCache = geoJson;

            if (typeof onProgress === 'function') onProgress('indexing');
            const builtIndex = buildSpatialIndex(geoJson);

            // Lưu vào IndexedDB để lần sau không bao giờ phải tải lại 36MB
            saveSpatialIndexToStorage({
                provinces: builtIndex.provinces,
                districts: builtIndex.districts,
                totalDistricts: builtIndex.totalDistricts,
                totalProvinces: builtIndex.totalProvinces,
            });

            _activeSpatialIndex = builtIndex;
            return builtIndex;
        } catch (error) {
            console.error('[SpatialLoader] Error initializing spatial index:', error);
            _loadingPromise = null;
            return null;
        } finally {
            _loadingPromise = null;
        }
    })();

    return _loadingPromise;
}

export function getCachedSpatialIndexSync() {
    return _activeSpatialIndex;
}

export function getCachedRawGeoJsonSync() {
    return _rawGeoJsonCache;
}
