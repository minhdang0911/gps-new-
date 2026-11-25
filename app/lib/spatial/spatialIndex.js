/**
 * @file spatialIndex.js
 * @description Xây dựng và tra cứu cây chỉ mục không gian 2 tầng (2-Tier Spatial Index).
 */

import {
    computeMultiPolyBBox,
    computeMultiPolyCentroid,
    isPointInsideBBox,
    fastPointInMultiPolygon,
} from './spatialMath.js';

/**
 * Xây dựng chỉ mục không gian 2 tầng từ GeoJSON gốc.
 * Tầng 1: 63 Tỉnh Thành (Province BBox)
 * Tầng 2: Quận Huyện trực thuộc Tỉnh (District BBox + Coordinates)
 * Thời gian dựng: ~35ms cho toàn bộ 705 quận huyện.
 */
export function buildSpatialIndex(geoJson) {
    if (!geoJson || !Array.isArray(geoJson.features)) {
        throw new Error('[SpatialIndex] Invalid GeoJSON structure');
    }

    const provinceMap = new Map();
    const districtList = [];

    geoJson.features.forEach((feature) => {
        if (!feature.geometry || feature.geometry.type !== 'MultiPolygon') return;

        const coords = feature.geometry.coordinates;
        const bbox = computeMultiPolyBBox(coords);
        const centroid = computeMultiPolyCentroid(coords);

        feature.centroid = centroid;
        feature._center = {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [centroid.longitude, centroid.latitude] },
        };

        const districtItem = {
            id: String(feature.properties?.ma_huyen || ''),
            name: feature.properties?.ten_huyen || '',
            type: feature.properties?.loai || '',
            provinceId: String(feature.properties?.ma_tinh || ''),
            provinceName: feature.properties?.ten_tinh || '',
            bbox,
            centroid,
            coordinates: coords,
            rawFeature: feature,
        };

        districtList.push(districtItem);

        // Nhóm theo tỉnh (Tier 1)
        const provId = districtItem.provinceId;
        if (!provinceMap.has(provId)) {
            provinceMap.set(provId, {
                id: provId,
                name: districtItem.provinceName,
                bbox: [Infinity, Infinity, -Infinity, -Infinity],
                districts: [],
            });
        }

        const prov = provinceMap.get(provId);
        prov.districts.push(districtItem);
        prov.bbox[0] = Math.min(prov.bbox[0], bbox[0]);
        prov.bbox[1] = Math.min(prov.bbox[1], bbox[1]);
        prov.bbox[2] = Math.max(prov.bbox[2], bbox[2]);
        prov.bbox[3] = Math.max(prov.bbox[3], bbox[3]);
    });

    return {
        provinces: Array.from(provinceMap.values()),
        provinceMap,
        districts: districtList,
        totalDistricts: districtList.length,
        totalProvinces: provinceMap.size,
    };
}

/**
 * Tra cứu quận huyện cho tọa độ (lon, lat).
 * Nếu có targetProvinceId, chỉ duyệt các quận trong tỉnh đó (thời gian < 0.01 ms).
 * Nếu không có, duyệt qua 63 Tỉnh trước, sau đó duyệt quận của tỉnh trùng khớp.
 */
export function queryDistrictByCoordinate(lon, lat, spatialIndex, targetProvinceId = null) {
    if (!spatialIndex || lon == null || lat == null) return null;

    // Trường hợp 1: Đã biết tỉnh (người dùng đang drill-down vào 1 tỉnh cụ thể)
    if (targetProvinceId) {
        const provIdStr = String(targetProvinceId);
        const province = spatialIndex.provinceMap?.get(provIdStr);
        if (province && province.districts) {
            for (let i = 0; i < province.districts.length; i++) {
                const dist = province.districts[i];
                if (!isPointInsideBBox(lon, lat, dist.bbox)) continue;
                if (fastPointInMultiPolygon(lon, lat, dist.coordinates)) {
                    return dist;
                }
            }
        }
        return null;
    }

    // Trường hợp 2: Chưa biết tỉnh (tra cứu toàn quốc)
    const provinces = spatialIndex.provinces || [];
    for (let p = 0; p < provinces.length; p++) {
        const prov = provinces[p];
        if (!isPointInsideBBox(lon, lat, prov.bbox)) continue;

        // Chỉ kiểm tra các quận của tỉnh vừa trúng BBox
        for (let d = 0; d < prov.districts.length; d++) {
            const dist = prov.districts[d];
            if (!isPointInsideBBox(lon, lat, dist.bbox)) continue;
            if (fastPointInMultiPolygon(lon, lat, dist.coordinates)) {
                return dist;
            }
        }
    }

    return null;
}
