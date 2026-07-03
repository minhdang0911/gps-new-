// lib/utils/geo.js

/**
 * Tính khoảng cách giữa 2 tọa độ theo đơn vị **mét**
 * Dùng công thức Haversine.
 *
 * 👉 Ứng dụng trong project:
 *    - Dùng để check xem xe di chuyển đủ xa chưa
 *    - Nếu xe di chuyển < MIN_MOVE_METERS (ví dụ 15m) → KHÔNG gọi API lấy địa chỉ
 *    - Nhằm giảm spam API reverse geocode (Goong/Vietmap/OpenCage…), tránh 429 quota
 *
 * @param {number} lat1 - vĩ độ điểm 1
 * @param {number} lon1 - kinh độ điểm 1
 * @param {number} lat2 - vĩ độ điểm 2
 * @param {number} lon2 - kinh độ điểm 2
 * @returns {number|null} - khoảng cách tính bằng mét, hoặc null nếu input sai
 */
export function getDistanceMeters(lat1, lon1, lat2, lon2) {
    // Validate input
    if (
        lat1 == null ||
        lon1 == null ||
        lat2 == null ||
        lon2 == null ||
        isNaN(lat1) ||
        isNaN(lon1) ||
        isNaN(lat2) ||
        isNaN(lon2)
    ) {
        return null;
    }

    const R = 6371000; // bán kính Trái đất (m)

    // Đổi độ sang radian
    const toRad = (deg) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    // Công thức Haversine
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // mét
}

/**
 * Tính khoảng cách giữa 2 tọa độ theo đơn vị **km**
 * (Wrapper của getDistanceMeters, tiện dùng cho province-level)
 */
export function getDistanceKm(lat1, lon1, lat2, lon2) {
    const m = getDistanceMeters(lat1, lon1, lat2, lon2);
    return m == null ? null : m / 1000;
}

/**
 * Tìm item gần nhất trong danh sách theo tọa độ (lat/lon).
 * Mỗi item cần có field `latitude` và `longitude` (string hoặc number).
 *
 * Dùng cho: province/district lookup trong Overview.
 *
 * @param {number} lat
 * @param {number} lon
 * @param {Array<{latitude: string|number, longitude: string|number}>} list
 * @returns {object|null} item gần nhất hoặc null nếu list rỗng
 */
export function findNearest(lat, lon, list) {
    if (!list?.length) return null;
    let best = null;
    let bestDist = Infinity;
    for (const item of list) {
        const d = getDistanceKm(lat, lon, parseFloat(item.latitude), parseFloat(item.longitude));
        if (d != null && d < bestDist) {
            bestDist = d;
            best = item;
        }
    }
    return best;
}
