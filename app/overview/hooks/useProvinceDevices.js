/**
 * @file useProvinceDevices.js
 * @description Hook quản lý danh mục 63 tỉnh thành và gom nhóm thiết bị theo ranh giới địa giới hành chính (Point-in-Polygon).
 */

'use client';

import { useState, useEffect, useMemo } from 'react';

const PROVINCE_API = 'https://esgoo.net/api-tinhthanh/1/0.htm';
const PROVINCES_CACHE_KEY = 'iky_provinces_cache';

let _cachedPreparedGeo = null;
let _geoFetchPromise = null;

const cleanName = (s) => (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/^(tinh|thanh pho|tp\.?)\s+/g, '')
    .replace(/\s+/g, '');

function pointInPolygon(lon, lat, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [xi, yi] = polygon[i];
        const [xj, yj] = polygon[j];
        const intersect = ((yi > lat) !== (yj > lat)) &&
            (lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function pointInFeature(lon, lat, feature) {
    const geom = feature?.geometry;
    if (!geom) return false;
    if (geom.type === 'Polygon') return pointInPolygon(lon, lat, geom.coordinates[0]);
    if (geom.type === 'MultiPolygon') {
        for (const poly of geom.coordinates) {
            if (pointInPolygon(lon, lat, poly[0])) return true;
        }
    }
    return false;
}

function prepareGeoFeatures(rawFeatures, provMap) {
    return rawFeatures.map((f) => {
        let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
        const geom = f.geometry;
        const polys = geom?.type === 'Polygon' ? [geom.coordinates] : (geom?.coordinates || []);
        for (const poly of polys) {
            for (const [x, y] of (poly[0] || [])) {
                if (x < minLon) minLon = x;
                if (x > maxLon) maxLon = x;
                if (y < minLat) minLat = y;
                if (y > maxLat) maxLat = y;
            }
        }
        const realName = f.properties?.oldName || f.properties?.name;
        const prov = provMap.get(cleanName(realName));
        return { feature: f, prov, minLon, maxLon, minLat, maxLat };
    });
}

export function useProvinceDevices(devices = [], cruiseByImei = {}) {
    const [provinces, setProvinces] = useState([]);
    const [geoLoaded, setGeoLoaded] = useState(() => !!_cachedPreparedGeo);

    // 1. Tải danh mục 63 tỉnh từ API (kèm Cache)
    useEffect(() => {
        const cached = typeof window !== 'undefined' ? localStorage.getItem(PROVINCES_CACHE_KEY) : null;
        if (cached) {
            try {
                setProvinces(JSON.parse(cached));
                return;
            } catch {}
        }
        fetch(PROVINCE_API)
            .then((r) => r.json())
            .then((d) => {
                const list = d.data || [];
                setProvinces(list);
                if (list.length) localStorage.setItem(PROVINCES_CACHE_KEY, JSON.stringify(list));
            })
            .catch(console.error);
    }, []);

    // 2. Tải bản đồ ranh giới GeoJSON để kiểm tra Point-in-Polygon
    useEffect(() => {
        if (_cachedPreparedGeo || !provinces.length) return;
        if (!_geoFetchPromise) {
            _geoFetchPromise = fetch('/vn_geo.json')
                .then((r) => r.json())
                .then((data) => data.features || [])
                .catch((e) => {
                    console.warn('[useProvinceDevices] Failed to load vn_geo.json:', e);
                    return [];
                });
        }
        _geoFetchPromise.then((features) => {
            if (features.length && provinces.length) {
                const provMap = new Map();
                provinces.forEach((p) => {
                    provMap.set(cleanName(p.name), p);
                    provMap.set(cleanName(p.full_name), p);
                });
                _cachedPreparedGeo = prepareGeoFeatures(features, provMap);
                setGeoLoaded(true);
            }
        });
    }, [provinces]);

    // 3. Phân loại xe theo Tỉnh bằng Point-in-Polygon (chính xác ranh giới 100%, fallback tâm)
    const provinceGroups = useMemo(() => {
        if (!provinces.length || !devices.length) return {};
        const groups = {};
        const prepared = _cachedPreparedGeo;
        const coordCache = new Map();

        for (let i = 0; i < devices.length; i++) {
            const d = devices[i];
            const cruise = cruiseByImei[d.imei];
            if (!cruise?.lat || !cruise?.lon) continue;

            const lat = parseFloat(cruise.lat);
            const lon = parseFloat(cruise.lon);
            if (isNaN(lat) || isNaN(lon)) continue;

            const cacheKey = `${Math.round(lat * 1000)}_${Math.round(lon * 1000)}`;
            let best = coordCache.get(cacheKey);

            if (!best) {
                // Bước 1: Kiểm tra Bounding Box + Point-in-Polygon chuẩn xác
                if (prepared && prepared.length) {
                    for (let j = 0; j < prepared.length; j++) {
                        const item = prepared[j];
                        if (lat >= item.minLat && lat <= item.maxLat && lon >= item.minLon && lon <= item.maxLon) {
                            if (pointInFeature(lon, lat, item.feature)) {
                                best = item.prov;
                                break;
                            }
                        }
                    }
                }

                // Bước 2: Fallback khoảng cách tâm nếu xe nằm trên mép ranh giới ngoài polygon
                if (!best) {
                    let bestDist = Infinity;
                    for (let j = 0; j < provinces.length; j++) {
                        const p = provinces[j];
                        const dLat = p.latitude - lat;
                        const dLon = p.longitude - lon;
                        const dist = dLat * dLat + dLon * dLon;
                        if (dist < bestDist) {
                            bestDist = dist;
                            best = p;
                        }
                    }
                }

                if (best) coordCache.set(cacheKey, best);
            }

            if (best) {
                if (!groups[best.id]) groups[best.id] = { province: best, items: [] };
                groups[best.id].items.push({ device: d, cruise });
            }
        }
        return groups;
    }, [provinces, devices, cruiseByImei, geoLoaded]);

    return { provinces, provinceGroups };
}
