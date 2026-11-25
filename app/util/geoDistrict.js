/**
 * @file geoDistrict.js
 * @description Adapter tương thích ngược, tích hợp IKY-SpatialCore Engine vào hệ thống.
 */

import { getOrLoadSpatialIndex, getCachedSpatialIndexSync, getCachedRawGeoJsonSync } from '../lib/spatial/spatialLoader';
import { classifyCoordinateWithCache } from '../lib/spatial/spatialClassifier';
import { findNearest } from './geo';

export const normalizeGeoName = (str = '') =>
    str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/^(thanh pho|tp\.?|tinh|quan|huyen|thi xa)\s+/i, '')
        .trim();

/**
 * Tải chỉ mục không gian quận huyện qua singleton loader (được lưu tại IndexedDB).
 */
export const loadDistrictGeoJson = () => {
    return getOrLoadSpatialIndex().then((spatialIndex) => {
        return spatialIndex || getCachedRawGeoJsonSync();
    });
};

export const getDistrictGeoJsonCache = () => {
    return getCachedRawGeoJsonSync() || getCachedSpatialIndexSync();
};

/**
 * Xác định chính xác quận/huyện từ tọa độ GPS (lat, lon) dùng IKY-SpatialCore 2-Tier Index.
 * 
 * @param {number} lat - Vĩ độ
 * @param {number} lon - Kinh độ
 * @param {object} [options]
 * @param {Array} [options.districtList] - Danh sách quận huyện fallback
 * @param {string|number} [options.provinceId] - ID tỉnh (ví dụ 01 hoặc 79)
 * @param {string} [options.provinceName] - Tên tỉnh
 * @returns {object|null} { feature, district, id }
 */
export const findDistrictForPoint = (
    lat,
    lon,
    { districtList = null, provinceId = null, provinceName = null } = {},
) => {
    if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) return null;

    const spatialIndex = getCachedSpatialIndexSync();

    if (spatialIndex) {
        const match = classifyCoordinateWithCache(lon, lat, spatialIndex, provinceId);
        if (match) {
            return {
                feature: match.rawFeature || { properties: { ma_huyen: match.id, ten_huyen: match.name, ma_tinh: match.provinceId } },
                district: match.name,
                id: match.id,
            };
        }
    }

    // Fallback nếu chưa tải xong index và có danh sách tâm quận huyện
    if (districtList?.length) {
        const nearest = findNearest(lat, lon, districtList);
        if (nearest) {
            return {
                feature: null,
                district: nearest.name,
                id: nearest.id,
            };
        }
    }

    return null;
};
