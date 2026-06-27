/**
 * clusterWorker.js — Chạy trên Web Worker thread
 * Tính haversine groupByProvince/groupByDistrict ngoài main thread
 * → Bản đồ không bao giờ đóng băng dù 50k+ devices
 */

// Haversine distance (km)
function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findNearest(lat, lon, list) {
    let best = null, bestDist = Infinity;
    for (const item of list) {
        const d = haversine(lat, lon, parseFloat(item.latitude), parseFloat(item.longitude));
        if (d < bestDist) { bestDist = d; best = item; }
    }
    return best;
}

function isOnline(cruise) {
    if (!cruise) return false;
    const updated = cruise.updatedAt || cruise.createdAt;
    if (!updated) return false;
    return Date.now() - new Date(updated).getTime() < 24 * 60 * 60 * 1000;
}

self.onmessage = ({ data }) => {
    const { type, devices, cruiseByImei, provinces } = data;

    if (type === 'GROUP_BY_PROVINCE') {
        const groups = {};
        for (const d of devices) {
            const cruise = cruiseByImei[d.imei];
            if (!cruise?.lat || !cruise?.lon) continue;
            const prov = findNearest(cruise.lat, cruise.lon, provinces);
            if (!prov) continue;
            const key = prov.id;
            if (!groups[key]) groups[key] = { province: prov, items: [] };
            groups[key].items.push({ device: d, cruise, online: isOnline(cruise) });
        }
        self.postMessage({ type: 'GROUP_BY_PROVINCE_RESULT', groups });
    }
};
