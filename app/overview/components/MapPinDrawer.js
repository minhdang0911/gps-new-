/**
 * @file MapPinDrawer.js
 * @description Vẽ các marker, cluster và device pins trên Leaflet với thuật toán spiral jitter chống chồng đè.
 */

import { createClusterSvg } from './MapClusterIcons';

const isOnlineCruise = (cruise) => {
    if (!cruise) return false;
    const updated = cruise.updatedAt || cruise.createdAt;
    if (!updated) return false;
    return Date.now() - new Date(updated).getTime() < 24 * 60 * 60 * 1000;
};

/**
 * Thuật toán dãn cách thông minh chống đè chùm các cụm tỉnh thành ở gần nhau
 */
function resolveClusterPositions(rawClusters, minDistance = 0.38) {
    const list = rawClusters.map((c) => ({ ...c }));
    list.sort((a, b) => b.total - a.total);

    for (let iter = 0; iter < 3; iter++) {
        for (let i = 0; i < list.length; i++) {
            for (let j = i + 1; j < list.length; j++) {
                const a = list[i];
                const b = list[j];
                const dLat = b.lat - a.lat;
                const dLon = b.lon - a.lon;
                const dist = Math.sqrt(dLat * dLat + dLon * dLon);
                if (dist < minDistance) {
                    const overlap = minDistance - (dist || 0.001);
                    const angle = dist > 0.001 ? Math.atan2(dLat, dLon) : (j * 0.7);
                    b.lat += Math.sin(angle) * overlap;
                    b.lon += Math.cos(angle) * overlap;
                }
            }
        }
    }
    return list;
}

/**
 * Vẽ các cụm Tỉnh (Level 0) với thuật toán khử chồng đè và phân cấp kích thước
 */
export function drawProvinceClusters(L, layer, provinceGroups, onSelectProvince) {
    if (!L || !layer || !provinceGroups) return;
    layer.clearLayers();

    const rawList = Object.values(provinceGroups).map(({ province, items }) => ({
        province,
        items,
        total: items.length,
        online: items.filter((i) => isOnlineCruise(i.cruise)).length,
        lat: parseFloat(province.latitude),
        lon: parseFloat(province.longitude),
        rawLat: parseFloat(province.latitude),
        rawLon: parseFloat(province.longitude),
    })).filter((c) => !isNaN(c.lat) && !isNaN(c.lon));

    const spacedList = resolveClusterPositions(rawList);

    spacedList.forEach(({ province, total, online, lat, lon, rawLat, rawLon }) => {
        const sz = total >= 50 ? 36 : total >= 10 ? 28 : total >= 3 ? 24 : 20;
        const icon = L.divIcon({
            className: '',
            iconSize: [sz, sz],
            iconAnchor: [sz / 2, sz / 2],
            html: createClusterSvg(total, online, total, 'province'),
        });

        const marker = L.marker([lat, lon], { icon });
        marker.bindTooltip(`<b>${province.full_name}</b><br>${total} thiết bị · ${online} online`, {
            direction: 'top',
            offset: [0, -sz / 2 - 2],
        });
        marker.on('click', () => onSelectProvince(province, [rawLat, rawLon]));
        layer.addLayer(marker);
    });
}

/**
 * Vẽ các cụm Quận/Huyện (Level 1)
 */
export function drawDistrictClusters(L, layer, districtGroups, onSelectDistrict) {
    if (!L || !layer || !districtGroups) return [];
    layer.clearLayers();

    const bounds = [];

    Object.values(districtGroups).forEach((group) => {
        const { district, districtInfo, items } = group;
        if (!items || !items.length) return;
        const online = items.filter((i) => isOnlineCruise(i.cruise)).length;
        const total = items.length;

        let lat = districtInfo?.centroid?.latitude || district?.centroid?.latitude;
        let lon = districtInfo?.centroid?.longitude || district?.centroid?.longitude;

        if (lat == null || lon == null) {
            const centerCoords = district?._center?.geometry?.coordinates;
            if (centerCoords && centerCoords.length >= 2) {
                lon = centerCoords[0];
                lat = centerCoords[1];
            }
        }

        // Fallback: tính trung bình vị trí thực của các xe trong quận
        if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) {
            let sumLat = 0, sumLon = 0, count = 0;
            items.forEach((item) => {
                if (item.cruise?.lat != null && item.cruise?.lon != null) {
                    sumLat += parseFloat(item.cruise.lat);
                    sumLon += parseFloat(item.cruise.lon);
                    count++;
                }
            });
            if (count > 0) {
                lat = sumLat / count;
                lon = sumLon / count;
            }
        }

        if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) return;

        bounds.push([lat, lon]);

        const sz = Math.round(Math.max(26, Math.min(38, 26 + Math.log10(total + 1) * 8)));
        const icon = L.divIcon({
            className: '',
            iconSize: [sz, sz],
            iconAnchor: [sz / 2, sz / 2],
            html: createClusterSvg(total, online, total, 'district'),
        });

        const districtName = districtInfo?.name || district?.name || district?.properties?.ten_huyen || 'Quận/Huyện';
        const marker = L.marker([lat, lon], { icon });
        marker.bindTooltip(`<b>${districtName}</b><br>${total} thiết bị · ${online} online`, {
            direction: 'top',
            offset: [0, -23],
        });
        marker.on('click', () => onSelectDistrict(districtInfo || district, [lat, lon]));
        layer.addLayer(marker);
    });

    return bounds;
}

/**
 * Vẽ chi tiết từng thiết bị kèm spiral jitter chống đè (Level 2 & Force All)
 */
export function drawIndividualDevicePins(L, layer, devicesList, cruiseByImei, onSelectDevice) {
    if (!L || !layer || !devicesList) return [];
    layer.clearLayers();

    const bounds = [];
    const coordGroups = {};

    devicesList.forEach((d) => {
        const cruise = cruiseByImei ? cruiseByImei[d.imei] : null;
        if (!cruise || cruise.lat == null || cruise.lon == null) return;
        const key = `${cruise.lat.toFixed(5)},${cruise.lon.toFixed(5)}`;
        if (!coordGroups[key]) coordGroups[key] = [];
        coordGroups[key].push({ device: d, cruise });
    });

    Object.values(coordGroups).forEach((group) => {
        group.forEach(({ device: d, cruise }, idx) => {
            const online = isOnlineCruise(cruise);
            const color = online ? '#22c55e' : '#ef4444';

            let lat = cruise.lat;
            let lon = cruise.lon;
            if (idx > 0) {
                const ring = Math.ceil(idx / 6);
                const angle = (idx % 6) * (Math.PI / 3) + ring * 0.5;
                const radius = 0.000035 * ring;
                lat = cruise.lat + radius * Math.cos(angle);
                lon = cruise.lon + (radius * Math.sin(angle)) / Math.cos((cruise.lat * Math.PI) / 180);
            }

            const svgHtml = `<svg width="26" height="34" viewBox="0 0 36 47" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 0C8.06 0 0 8.06 0 18c0 12.5 18 29 18 29S36 30.5 36 18C36 8.06 27.94 0 18 0z" fill="${color}" stroke="white" stroke-width="2"/>
                <circle cx="18" cy="18" r="8" fill="white"/>
                <circle cx="18" cy="18" r="4.5" fill="${color}"/>
            </svg>`;

            const icon = L.divIcon({
                className: '',
                iconSize: [26, 34],
                iconAnchor: [13, 34],
                html: svgHtml,
            });

            const marker = L.marker([lat, lon], { icon });
            marker.bindTooltip(
                `<b>${d.license_plate || d.imei}</b><br><svg width="8" height="8" viewBox="0 0 8 8" style="vertical-align:middle;margin-right:3px"><circle cx="4" cy="4" r="4" fill="${online ? '#22c55e' : '#ef4444'}"/></svg>${online ? 'Online' : 'Offline'}`,
                { direction: 'top', offset: [0, -35] },
            );
            marker.on('click', () => onSelectDevice(d, cruise));
            layer.addLayer(marker);
            bounds.push([lat, lon]);
        });
    });

    return bounds;
}
