import { GOONG_KEYS, getCurrentGoongKey } from '../address/keys';

const distanceM = (p1, p2) => {
    if (!p1 || !p2) return 0;
    const lat1 = p1.lat ?? p1[0];
    const lon1 = p1.lon ?? p1[1];
    const lat2 = p2.lat ?? p2[0];
    const lon2 = p2.lon ?? p2[1];
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 0;
    const dLat = (lat2 - lat1) * 111320;
    const dLon = (lon2 - lon1) * 111320 * Math.cos((lat1 * Math.PI) / 180);
    return Math.sqrt(dLat * dLat + dLon * dLon);
};

export const filterStationaryAndJumps = (points, minMovingDistM = 12, maxJumpM = 160) => {
    if (!points || points.length < 2) return points || [];
    const isValid = (p) => p && typeof p.lat === 'number' && typeof p.lon === 'number' && !isNaN(p.lat) && !isNaN(p.lon);

    const out = [];
    let lastValid = null;

    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        if (!isValid(p)) continue;

        if (!lastValid) {
            out.push(p);
            lastValid = p;
            continue;
        }

        const dist = distanceM(lastValid, p);
        const spd = Number(p.spd ?? p.velocityNum ?? p.vgp ?? 0);

        // Lọc nhiễu đứng yên khi tốc độ <= 2km/h
        if (spd <= 2 && dist < minMovingDistM) {
            continue;
        }

        // Lọc điểm nhảy GPS ảo khi tốc độ thấp
        if (dist > maxJumpM && spd <= 5) {
            continue;
        }

        out.push(p);
        lastValid = p;
    }

    const lastRaw = [...points].reverse().find(isValid);
    if (lastRaw && out[out.length - 1] !== lastRaw) {
        out.push(lastRaw);
    }

    return out;
};

// Giải mã Google/Goong encoded polyline
const decodePolyline = (str, precision = 5) => {
    if (!str) return [];
    let index = 0,
        lat = 0,
        lng = 0,
        coordinates = [];
    const factor = Math.pow(10, precision);
    while (index < str.length) {
        let b,
            shift = 0,
            result = 0;
        do {
            b = str.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        const dlat = result & 1 ? ~(result >> 1) : result >> 1;
        lat += dlat;
        shift = 0;
        result = 0;
        do {
            b = str.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        const dlng = result & 1 ? ~(result >> 1) : result >> 1;
        lng += dlng;
        coordinates.push([lat / factor, lng / factor]);
    }
    return coordinates;
};

// Tìm đường bám đường giữa 2 điểm (hàn gắn khe hở giữa các matching/chunk)
const routeBetweenPoints = async (p1, p2, options = {}) => {
    const lat1 = p1.lat ?? p1[0];
    const lon1 = p1.lon ?? p1[1];
    const lat2 = p2.lat ?? p2[0];
    const lon2 = p2.lon ?? p2[1];

    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
    const dist = distanceM(p1, p2);
    if (dist < 15) return [[lat1, lon1], [lat2, lon2]];

    // 1. Thử OSRM Route
    try {
        const url = `https://router.project-osrm.org/route/v1/driving/${lon1.toFixed(6)},${lat1.toFixed(6)};${lon2.toFixed(6)},${lat2.toFixed(6)}?overview=full&geometries=geojson`;
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 4000);
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(t);
        if (res.ok) {
            const data = await res.json();
            if (data.code === 'Ok' && data.routes?.[0]?.geometry?.coordinates?.length) {
                return data.routes[0].geometry.coordinates.map((c) => [c[1], c[0]]);
            }
        }
    } catch (_) {}

    // 2. Thử Goong Direction (chính xác nhất cho đường/ngõ Việt Nam)
    const goongKey = getCurrentGoongKey() || options.goongKey || process.env.NEXT_PUBLIC_GOONG_API_KEY;
    if (goongKey) {
        try {
            const url = `https://rsapi.goong.io/Direction?origin=${lat1.toFixed(6)},${lon1.toFixed(6)}&destination=${lat2.toFixed(6)},${lon2.toFixed(6)}&vehicle=car&api_key=${goongKey}`;
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 4000);
            const res = await fetch(url, { signal: ctrl.signal });
            clearTimeout(t);
            if (res.ok) {
                const data = await res.json();
                const enc = data.routes?.[0]?.overview_polyline?.points;
                if (enc) {
                    const dec = decodePolyline(enc);
                    if (dec.length) return dec;
                }
            }
        } catch (_) {}
    }

    // 3. Thử Mapbox Direction
    const mapboxToken = options.mapboxToken || process.env.NEXT_PUBLIC_MAPBOX_API_KEY;
    if (mapboxToken) {
        try {
            const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${lon1.toFixed(6)},${lat1.toFixed(6)};${lon2.toFixed(6)},${lat2.toFixed(6)}?overview=full&geometries=geojson&access_token=${mapboxToken}`;
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 4000);
            const res = await fetch(url, { signal: ctrl.signal });
            clearTimeout(t);
            if (res.ok) {
                const data = await res.json();
                if (data.code === 'Ok' && data.routes?.[0]?.geometry?.coordinates?.length) {
                    return data.routes[0].geometry.coordinates.map((c) => [c[1], c[0]]);
                }
            }
        } catch (_) {}
    }

    return [[lat1, lon1], [lat2, lon2]];
};

// Khi một chunk không match được (do ngõ sâu/tòa nhà), định tuyến theo đường xe chạy qua các mốc chính
const routeChunkWithRoads = async (chunk, options = {}) => {
    if (!chunk || chunk.length < 2) return (chunk || []).map((p) => [p.lat, p.lon]);

    // Trích xuất 5-7 mốc chính dọc theo chunk
    const stride = Math.max(1, Math.floor(chunk.length / 5));
    const waypoints = [];
    for (let i = 0; i < chunk.length; i += stride) {
        waypoints.push(chunk[i]);
    }
    const last = chunk[chunk.length - 1];
    if (waypoints[waypoints.length - 1] !== last) {
        waypoints.push(last);
    }

    // Thử OSRM Route đa điểm
    try {
        const coordsStr = waypoints.map((p) => `${p.lon.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
        const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`;
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(t);
        if (res.ok) {
            const data = await res.json();
            if (data.code === 'Ok' && data.routes?.[0]?.geometry?.coordinates?.length) {
                return data.routes[0].geometry.coordinates.map((c) => [c[1], c[0]]);
            }
        }
    } catch (_) {}

    // Hàn gắn từng chặng bằng routeBetweenPoints
    const out = [];
    for (let i = 0; i < waypoints.length - 1; i++) {
        const seg = await routeBetweenPoints(waypoints[i], waypoints[i + 1], options);
        if (seg && seg.length) {
            if (out.length > 0 && seg.length > 0) {
                out.push(...seg.slice(1));
            } else {
                out.push(...seg);
            }
        }
    }
    return out.length >= 2 ? out : chunk.map((p) => [p.lat, p.lon]);
};

// Nối các đoạn matching lại với nhau, bắc cầu đường xe chạy nếu giữa 2 matching có khoảng hở > 25m
const stitchMatchingsWithBridges = async (matchings, options = {}) => {
    if (!matchings || !matchings.length) return null;
    const stitched = [];

    for (let i = 0; i < matchings.length; i++) {
        const m = matchings[i];
        const coords = m.geometry?.coordinates?.map((c) => [c[1], c[0]]) || [];
        if (!coords.length) continue;

        if (stitched.length > 0) {
            const last = stitched[stitched.length - 1];
            const next = coords[0];
            const gap = distanceM(last, next);

            // Nếu giữa 2 matching có khoảng hở > 25m, dùng router uốn theo đường phố thay vì kẻ thẳng
            if (gap > 25) {
                const bridge = await routeBetweenPoints(last, next, options);
                if (bridge && bridge.length > 1) {
                    stitched.push(...bridge.slice(1, -1));
                }
            }
        }

        if (stitched.length > 0 && coords.length > 0) {
            const last = stitched[stitched.length - 1];
            const first = coords[0];
            if (Math.abs(last[0] - first[0]) < 0.00005 && Math.abs(last[1] - first[1]) < 0.00005) {
                stitched.push(...coords.slice(1));
            } else {
                stitched.push(...coords);
            }
        } else {
            stitched.push(...coords);
        }
    }

    return stitched.length >= 2 ? stitched : null;
};

const matchChunkWithOsrm = async (chunk, options = {}) => {
    try {
        const coordsStr = chunk.map((p) => `${p.lon.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
        // Bán kính quét 80m để bao trọn cả ngõ ngách, đường nội bộ
        const radiuses = chunk.map(() => '80').join(';');
        const url = `https://router.project-osrm.org/match/v1/driving/${coordsStr}?geometries=geojson&overview=full&radiuses=${radiuses}&gaps=ignore&tidy=true`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        if (!res.ok) return null;
        const data = await res.json();
        if (data.code === 'Ok' && data.matchings && data.matchings.length > 0) {
            return await stitchMatchingsWithBridges(data.matchings, options);
        }
        return null;
    } catch (_) {
        return null;
    }
};

const matchChunkWithMapbox = async (chunk, mapboxToken, options = {}) => {
    if (!mapboxToken) return null;
    try {
        const coordsStr = chunk.map((p) => `${p.lon.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
        const radiuses = chunk.map(() => '80').join(';');
        const url = `https://api.mapbox.com/matching/v5/mapbox/driving/${coordsStr}?geometries=geojson&overview=full&radiuses=${radiuses}&access_token=${mapboxToken}`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        if (!res.ok) return null;
        const data = await res.json();
        if (data.code === 'Ok' && data.matchings && data.matchings.length > 0) {
            return await stitchMatchingsWithBridges(data.matchings, options);
        }
        return null;
    } catch (_) {
        return null;
    }
};

export const snapRouteToRoads = async (points, options = {}) => {
    if (!points || points.length < 2) {
        return (points || []).map((p) => [p.lat, p.lon]);
    }

    const cleanedPoints = filterStationaryAndJumps(points, 12, 160);
    if (cleanedPoints.length < 2) {
        return cleanedPoints.map((p) => [p.lat, p.lon]);
    }

    const mapboxToken = options.mapboxToken || process.env.NEXT_PUBLIC_MAPBOX_API_KEY || '';
    // CHUNK_SIZE = 35: tối ưu độ ổn định, không bị dính NoSegment dây chuyền
    const CHUNK_SIZE = 35;
    const roadPolyline = [];

    for (let i = 0; i < cleanedPoints.length; i += CHUNK_SIZE - 1) {
        const chunk = cleanedPoints.slice(i, i + CHUNK_SIZE);
        if (chunk.length < 2) continue;

        // 1. Thử OSRM Match với radiuses 80m + gaps=ignore + bắc cầu khe hở
        let matched = await matchChunkWithOsrm(chunk, options);

        // 2. Nếu OSRM Match không được, thử Mapbox Matching
        if (!matched && mapboxToken) {
            matched = await matchChunkWithMapbox(chunk, mapboxToken, options);
        }

        // 3. Nếu cả 2 matching đều thất bại (ví dụ ngõ sâu không có segment),
        //    ĐỊNH TUYẾN THEO ĐƯỜNG XE CHẠY THẬT (OSRM/Goong Route) thay vì kẻ thẳng chim bay!
        if (!matched || matched.length < 2) {
            matched = await routeChunkWithRoads(chunk, options);
        }

        if (matched && matched.length > 0) {
            if (roadPolyline.length > 0) {
                const last = roadPolyline[roadPolyline.length - 1];
                const first = matched[0];
                const gap = distanceM(last, first);

                // Nếu khoảng cách giữa 2 chunk > 25m, bắc cầu uốn lượn theo đường phố
                if (gap > 25) {
                    const bridge = await routeBetweenPoints(last, first, options);
                    if (bridge && bridge.length > 1) {
                        roadPolyline.push(...bridge.slice(1, -1));
                    }
                } else if (gap < 5) {
                    matched = matched.slice(1);
                }
            }
            roadPolyline.push(...matched);
        }

        if (typeof options.onProgress === 'function') {
            const pct = Math.min(100, Math.round(((i + chunk.length) / cleanedPoints.length) * 100));
            options.onProgress(pct);
        }
    }

    return roadPolyline.length >= 2 ? roadPolyline : cleanedPoints.map((p) => [p.lat, p.lon]);
};
