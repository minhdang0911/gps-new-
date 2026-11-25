/**
 * @file spatialMath.js
 * @description Các hàm toán học không gian hiệu năng cao, zero-allocation cho Ray-Casting và BBox.
 */

/**
 * Kiểm tra nhanh điểm (lon, lat) có nằm trong Bounding Box [minLon, minLat, maxLon, maxLat] không.
 * Thời gian chạy: O(1) ~ 0.0001 ms.
 */
export function isPointInsideBBox(lon, lat, bbox) {
    if (!bbox) return false;
    return lon >= bbox[0] && lon <= bbox[2] && lat >= bbox[1] && lat <= bbox[3];
}

/**
 * Thuật toán Ray-Casting (Even-Odd) kiểm tra điểm (lon, lat) trong vòng khép kín (ring).
 * Không tạo object mới, chạy trực tiếp trên mảng tọa độ gốc.
 */
export function fastPointInRing(lon, lat, ring) {
    let isInside = false;
    const len = ring.length;
    for (let i = 0, j = len - 1; i < len; j = i++) {
        const xi = ring[i][0];
        const yi = ring[i][1];
        const xj = ring[j][0];
        const yj = ring[j][1];

        const isIntersect =
            yi > lat !== yj > lat &&
            lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;

        if (isIntersect) {
            isInside = !isInside;
        }
    }
    return isInside;
}

/**
 * Kiểm tra điểm (lon, lat) trong MultiPolygon GeoJSON coordinates.
 * Coordinates: [ Polygon[ Ring[ [lon, lat], ... ] ] ]
 */
export function fastPointInMultiPolygon(lon, lat, coordinates) {
    for (let p = 0; p < coordinates.length; p++) {
        const polygon = coordinates[p];
        // Kiểm tra vòng bao ngoài (outer ring = polygon[0])
        if (!fastPointInRing(lon, lat, polygon[0])) {
            continue;
        }

        // Kiểm tra các lỗ thủng (inner holes nếu có)
        let isInsideHole = false;
        for (let h = 1; h < polygon.length; h++) {
            if (fastPointInRing(lon, lat, polygon[h])) {
                isInsideHole = true;
                break;
            }
        }

        if (!isInsideHole) {
            return true;
        }
    }
    return false;
}

/**
 * Tính Bounding Box chuẩn [minLon, minLat, maxLon, maxLat] cho một MultiPolygon.
 */
export function computeMultiPolyBBox(coordinates) {
    let minLon = Infinity;
    let minLat = Infinity;
    let maxLon = -Infinity;
    let maxLat = -Infinity;

    for (let p = 0; p < coordinates.length; p++) {
        const rings = coordinates[p];
        for (let r = 0; r < rings.length; r++) {
            const ring = rings[r];
            for (let i = 0; i < ring.length; i++) {
                const lon = ring[i][0];
                const lat = ring[i][1];
                if (lon < minLon) minLon = lon;
                if (lat < minLat) minLat = lat;
                if (lon > maxLon) maxLon = lon;
                if (lat > maxLat) maxLat = lat;
            }
        }
    }

    return [minLon, minLat, maxLon, maxLat];
}

/**
 * Tính tâm (Centroid) xấp xỉ cho MultiPolygon.
 */
export function computeMultiPolyCentroid(coordinates) {
    const [minLon, minLat, maxLon, maxLat] = computeMultiPolyBBox(coordinates);
    return {
        longitude: (minLon + maxLon) / 2,
        latitude: (minLat + maxLat) / 2,
    };
}
