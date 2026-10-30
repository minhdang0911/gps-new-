// app/util/geoDistrict.js
import * as turf from '@turf/turf';
import { findNearest } from './geo';

let _geoJsonCache = null;
let _geoJsonPromise = null;

/**
 * Tải file GeoJSON 63 tỉnh thành & quận huyện (VietNam63.geojson)
 * Chỉ fetch 1 lần duy nhất trong toàn bộ vòng đời ứng dụng và cache lại.
 * Tự động tính toán _center và _bbox cho mỗi polygon để tra cứu siêu tốc.
 */
export const loadDistrictGeoJson = () => {
    if (_geoJsonCache) return Promise.resolve(_geoJsonCache);
    if (_geoJsonPromise) return _geoJsonPromise;

    _geoJsonPromise = fetch('/geojson/VietNam63.geojson')
        .then((r) => r.json())
        .then((geo) => {
            if (geo?.features) {
                geo.features.forEach((f) => {
                    try {
                        f._center = turf.centroid(f);
                        f._bbox = turf.bbox(f); // [minLon, minLat, maxLon, maxLat]
                    } catch (_) {}
                });
            }
            _geoJsonCache = geo;
            return geo;
        })
        .catch((err) => {
            console.error('Failed to load VietNam63.geojson:', err);
            _geoJsonPromise = null;
            return null;
        });

    return _geoJsonPromise;
};

export const getDistrictGeoJsonCache = () => _geoJsonCache;

export const normalizeGeoName = (str = '') =>
    str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/^(thanh pho|tp\.?|tinh|quan|huyen|thi xa)\s+/i, '')
        .trim();

/**
 * Xác định chính xác quận/huyện từ tọa độ GPS (lat, lon)
 * 1. Dùng Turf booleanPointInPolygon đối chiếu với ranh giới chuẩn hành chính từ VietNam63.geojson
 * 2. Lọc nhanh theo tỉnh và BBox để xử lý trong <1ms
 * 3. Nếu chưa tải xong GeoJSON hoặc điểm nằm ngoài biên, fallback sang khoảng cách gần nhất
 *
 * @param {number} lat - Vĩ độ
 * @param {number} lon - Kinh độ
 * @param {object} [options]
 * @param {Array} [options.districtList] - Danh sách quận/huyện từ API esgoo (có id, name, latitude, longitude)
 * @param {string|number} [options.provinceId] - ID tỉnh (ví dụ 79)
 * @param {string} [options.provinceName] - Tên tỉnh (ví dụ "Thành phố Hồ Chí Minh")
 * @param {object} [options.geoJson] - GeoJSON tuỳ chọn nếu có sẵn
 * @returns {object|null} { feature, district, id }
 */
export const findDistrictForPoint = (
    lat,
    lon,
    { districtList = null, provinceId = null, provinceName = null, geoJson = null } = {},
) => {
    if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) return null;

    const geo = geoJson || _geoJsonCache;
    let matchedFeature = null;

    if (geo?.features?.length) {
        const point = turf.point([lon, lat]);
        const targetProvName = provinceName ? normalizeGeoName(provinceName) : null;
        const targetProvId = provinceId ? String(provinceId) : null;

        // Lọc các features trong tỉnh trước để tối ưu tốc độ (20-30 features thay vì 700)
        let candidateFeatures = geo.features;
        if (targetProvId || targetProvName) {
            const filtered = geo.features.filter((f) => {
                const pId = f.properties?.ma_tinh ? String(f.properties.ma_tinh) : null;
                if (targetProvId && pId && pId === targetProvId) return true;
                const pName = f.properties?.ten_tinh || f.properties?.Ten_Tinh;
                if (targetProvName && pName && normalizeGeoName(pName) === targetProvName) return true;
                return false;
            });
            if (filtered.length > 0) {
                candidateFeatures = filtered;
            }
        }

        for (const feature of candidateFeatures) {
            if (!feature?.geometry) continue;

            // BBox pre-check: loại bỏ 95% cực nhanh
            if (feature._bbox) {
                const [minLon, minLat, maxLon, maxLat] = feature._bbox;
                if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) {
                    continue;
                }
            }

            try {
                if (turf.booleanPointInPolygon(point, feature)) {
                    matchedFeature = feature;
                    break;
                }
            } catch (_) {}
        }

        // Nếu điểm nằm sát biên tỉnh hoặc tỉnh ban đầu ước tính lệch, quét qua toàn bộ 63 tỉnh
        if (!matchedFeature && candidateFeatures !== geo.features) {
            for (const feature of geo.features) {
                if (!feature?.geometry) continue;
                if (feature._bbox) {
                    const [minLon, minLat, maxLon, maxLat] = feature._bbox;
                    if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) {
                        continue;
                    }
                }
                try {
                    if (turf.booleanPointInPolygon(point, feature)) {
                        matchedFeature = feature;
                        break;
                    }
                } catch (_) {}
            }
        }
    }

    // Nếu tìm thấy ranh giới Polygon chính xác
    if (matchedFeature) {
        const featMaHuyen = String(matchedFeature.properties?.ma_huyen || '');
        const rawTen = matchedFeature.properties?.ten_huyen || matchedFeature.properties?.Ten_Huyen || '';
        const featTenHuyen = normalizeGeoName(rawTen);

        if (districtList?.length) {
            // 1. Khớp theo mã huyện GSO (chuẩn nhất, ví dụ "777" cho Bình Tân, "775" cho Quận 6)
            let matchedDist = districtList.find((d) => String(d.id) === featMaHuyen);

            // 2. Fallback khớp theo tên
            if (!matchedDist && featTenHuyen) {
                matchedDist = districtList.find(
                    (d) => normalizeGeoName(d.name || d.full_name) === featTenHuyen,
                );
            }

            if (matchedDist) {
                return {
                    feature: matchedFeature,
                    district: matchedDist,
                    id: String(matchedDist.id),
                };
            }
        }

        return {
            feature: matchedFeature,
            district: {
                id: featMaHuyen,
                name: rawTen,
                full_name: `${matchedFeature.properties?.loai || ''} ${rawTen}`.trim(),
            },
            id: featMaHuyen,
        };
    }

    // Fallback: nếu GeoJSON chưa nạp xong hoặc tọa độ mép biển/ngoài biên giới
    if (districtList?.length) {
        const nearest = findNearest(lat, lon, districtList);
        if (nearest) {
            return {
                feature: null,
                district: nearest,
                id: String(nearest.id),
            };
        }
    }

    return null;
};
