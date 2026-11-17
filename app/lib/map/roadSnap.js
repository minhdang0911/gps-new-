import { GOONG_KEYS, getCurrentGoongKey, moveToNextGoongKey } from '../address/keys';

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

const polylineLengthM = (coords) => {
    if (!coords || coords.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < coords.length; i++) {
        total += distanceM(coords[i - 1], coords[i]);
    }
    return total;
};

const isPointParked = (p) => p?.statusType === 'PARK' || Number(p?.acc) === 1;

const isPointStationary = (p) => {
    if (!p) return true;
    if (isPointParked(p)) return true;
    const spd = Math.max(Number(p.spd ?? 0) || 0, Number(p.velocityNum ?? 0) || 0, Number(p.vgp ?? 0) || 0);
    return spd <= 2;
};

/**
 * Lọc nhiễu đứng yên (kể cả GPS trôi trong nhà 50-220m khi tắt máy acc=1 hoặc 0 km/h)
 * và lọc các cụm điểm nhảy ping-pong (nhảy vọt sang mái nhà bên kia đường rồi tự quay lại).
 */
export const filterStationaryAndJumps = (points, minMovingDistM = 12, maxJumpM = 160) => {
    if (!points || points.length < 2) return points || [];
    const isValid = (p) =>
        p && typeof p.lat === 'number' && typeof p.lon === 'number' && !isNaN(p.lat) && !isNaN(p.lon);

    const validPts = points.filter(isValid);
    if (validPts.length < 2) return validPts;

    // Bước 1: Gom cụm đứng yên/tắt máy theo mỏ neo (stationaryAnchor) để triệt tiêu GPS trôi trong nhà
    const stage1 = [];
    let stationaryAnchor = null;

    for (let i = 0; i < validPts.length; i++) {
        const p = validPts[i];
        const parked = isPointParked(p);
        const stationary = isPointStationary(p);
        const spd = Number(p.spd ?? p.velocityNum ?? p.vgp ?? 0) || 0;

        if (!stage1.length) {
            stage1.push(p);
            if (stationary) stationaryAnchor = p;
            continue;
        }

        const prev = stage1[stage1.length - 1];
        const distFromPrev = distanceM(prev, p);

        if (stationary) {
            if (!stationaryAnchor) stationaryAnchor = prev;
            const distFromAnchor = distanceM(stationaryAnchor, p);
            const anchorRadius = parked ? 220 : 80;
            if (distFromAnchor < anchorRadius || distFromPrev < minMovingDistM) {
                continue;
            }
            if (distFromPrev > maxJumpM) {
                continue;
            }
            stationaryAnchor = p;
        } else {
            stationaryAnchor = null;
            if (distFromPrev < 5) continue;
            if (distFromPrev > maxJumpM && spd <= 5) continue;
        }

        stage1.push(p);
    }

    // Bước 2: Loại bỏ cụm nhảy ping-pong (A -> B1..Bk văng xa rồi C quay về gần A)
    const out = [stage1[0]];
    let i = 1;
    while (i < stage1.length - 1) {
        const prev = out[out.length - 1];
        const curr = stage1[i];
        const dPrevCurr = distanceM(prev, curr);
        const stationary = isPointStationary(curr);

        if (dPrevCurr > 35) {
            let returnedIdx = -1;
            const maxLook = stationary ? 5 : 2;
            for (let step = 1; step <= maxLook && i + step < stage1.length; step++) {
                const cand = stage1[i + step];
                const dPrevCand = distanceM(prev, cand);
                const ratio = stationary ? 0.8 : 0.45;
                if (dPrevCand < Math.min(dPrevCurr * ratio, 55)) {
                    returnedIdx = i + step;
                    break;
                }
            }
            if (returnedIdx !== -1) {
                i = returnedIdx;
                continue;
            }
        }

        const spd = Number(curr.spd ?? curr.velocityNum ?? curr.vgp ?? 0) || 0;
        if ((stationary || spd <= 5) && dPrevCurr > maxJumpM) {
            i++;
            continue;
        }

        out.push(curr);
        i++;
    }

    if (stage1.length > 1) {
        const lastPt = stage1[stage1.length - 1];
        const prevKept = out[out.length - 1];
        const dLast = distanceM(prevKept, lastPt);
        if (!isPointStationary(lastPt)) {
            if (dLast >= 5) out.push(lastPt);
        } else if (dLast > 80 && dLast <= maxJumpM && !isPointParked(lastPt)) {
            out.push(lastPt);
        }
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

// Track các Goong key bị 401/403 để không gọi lại gây chậm
const deadGoongKeys = new Set();

const fetchGoongBikeRoute = async (lat1, lon1, lat2, lon2) => {
    const totalKeys = GOONG_KEYS?.length || 0;
    if (!totalKeys) return null;

    for (let attempt = 0; attempt < totalKeys; attempt++) {
        const rawKey = getCurrentGoongKey();
        const key = typeof rawKey === 'string' ? rawKey.trim() : '';
        if (!key || deadGoongKeys.has(key)) {
            moveToNextGoongKey();
            continue;
        }

        try {
            const url = `https://rsapi.goong.io/Direction?origin=${lat1.toFixed(6)},${lon1.toFixed(6)}&destination=${lat2.toFixed(6)},${lon2.toFixed(6)}&vehicle=bike&api_key=${key}`;
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 3500);
            const res = await fetch(url, { signal: ctrl.signal });
            clearTimeout(t);

            if (res.status === 401 || res.status === 403 || res.status === 429) {
                if (res.status === 401 || res.status === 403) deadGoongKeys.add(key);
                moveToNextGoongKey();
                continue;
            }

            if (res.ok) {
                const data = await res.json();
                const route = data.routes?.[0];
                if (!route) return null;

                // Giải mã chi tiết từng step.polyline (độ chính xác từng ngõ/cua, không bị cắt góc như overview_polyline)
                const detailed = [];
                if (Array.isArray(route.legs)) {
                    for (const leg of route.legs) {
                        if (!Array.isArray(leg.steps)) continue;
                        for (const step of leg.steps) {
                            const stepPts = decodePolyline(step.polyline?.points);
                            for (const pt of stepPts) {
                                const prev = detailed[detailed.length - 1];
                                if (!prev || Math.abs(prev[0] - pt[0]) > 1e-6 || Math.abs(prev[1] - pt[1]) > 1e-6) {
                                    detailed.push(pt);
                                }
                            }
                        }
                    }
                }
                if (detailed.length >= 2) return detailed;

                const enc = route.overview_polyline?.points;
                if (enc) {
                    const dec = decodePolyline(enc);
                    if (dec.length >= 2) return dec;
                }
                return null;
            }
        } catch (_) {
            // lỗi mạng tạm thời
            return null;
        }
    }
    return null;
};

// Tìm đường bám mặt đường giữa 2 điểm (ưu tiên Goong xe máy cho ngõ/hẻm VN khớp nền Google Maps)
const routeBetweenPoints = async (p1, p2, options = {}) => {
    const lat1 = p1.lat ?? p1[0];
    const lon1 = p1.lon ?? p1[1];
    const lat2 = p2.lat ?? p2[0];
    const lon2 = p2.lon ?? p2[1];

    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
    const dist = distanceM(p1, p2);
    if (dist < 15) return [[lat1, lon1], [lat2, lon2]];

    // Giới hạn chống vẽ vòng quay đầu ảo quá xa (nhưng đủ rộng cho vòng qua đầu ngõ/ngã tư phố VN)
    const maxAllowedDetourM = Math.max(650, dist * 6.5);

    // 1. Ưu tiên Goong Direction (vehicle=bike): khớp chuẩn Google Maps & ngõ ngách xe máy Việt Nam
    const goongDec = await fetchGoongBikeRoute(lat1, lon1, lat2, lon2);
    if (goongDec && polylineLengthM(goongDec) <= maxAllowedDetourM) {
        return goongDec;
    }

    // 2. Fallback Mapbox cycling / driving
    const mapboxToken = options.mapboxToken || process.env.NEXT_PUBLIC_MAPBOX_API_KEY;
    if (mapboxToken) {
        try {
            const url = `https://api.mapbox.com/directions/v5/mapbox/cycling/${lon1.toFixed(6)},${lat1.toFixed(6)};${lon2.toFixed(6)},${lat2.toFixed(6)}?overview=full&geometries=geojson&access_token=${mapboxToken}`;
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 3500);
            const res = await fetch(url, { signal: ctrl.signal });
            clearTimeout(t);
            if (res.ok) {
                const data = await res.json();
                const coords = data.routes?.[0]?.geometry?.coordinates?.map((c) => [c[1], c[0]]);
                if (coords?.length >= 2 && polylineLengthM(coords) <= maxAllowedDetourM) {
                    return coords;
                }
            }
        } catch (_) {}
    }

    // 3. Fallback OSRM Route
    try {
        const url = `https://router.project-osrm.org/route/v1/driving/${lon1.toFixed(6)},${lat1.toFixed(6)};${lon2.toFixed(6)},${lat2.toFixed(6)}?overview=full&geometries=geojson`;
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 3500);
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(t);
        if (res.ok) {
            const data = await res.json();
            const coords = data.routes?.[0]?.geometry?.coordinates?.map((c) => [c[1], c[0]]);
            if (coords?.length >= 2 && polylineLengthM(coords) <= maxAllowedDetourM) {
                return coords;
            }
        }
    } catch (_) {}

    return [[lat1, lon1], [lat2, lon2]];
};

// Khi một chunk đi trong ngõ sâu không có trên OSM/Mapbox, định tuyến qua các mốc chính bằng Goong bike
const routeChunkWithRoads = async (chunk, options = {}) => {
    if (!chunk || chunk.length < 2) return (chunk || []).map((p) => [p.lat, p.lon]);

    const stride = Math.max(1, Math.floor(chunk.length / 5));
    const waypoints = [];
    for (let i = 0; i < chunk.length; i += stride) {
        waypoints.push(chunk[i]);
    }
    const last = chunk[chunk.length - 1];
    if (waypoints[waypoints.length - 1] !== last) {
        waypoints.push(last);
    }

    const out = [];
    for (let i = 0; i < waypoints.length - 1; i++) {
        const seg = await routeBetweenPoints(waypoints[i], waypoints[i + 1], options);
        if (seg && seg.length) {
            if (out.length > 0) {
                out.push(...seg.slice(1));
            } else {
                out.push(...seg);
            }
        }
    }
    return out.length >= 2 ? out : chunk.map((p) => [p.lat, p.lon]);
};

// Nối các đoạn matching lại với nhau, bắc cầu theo ngõ/phố hợp lý
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

            if (gap > 20) {
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

/**
 * Mapbox Map Matching với bán kính chặt 25m:
 * - Không hút nhầm xe đang đỗ trong ngõ sâu (cách 40-50m) văng lên mặt đê/đường cao tốc.
 * - Hỗ trợ tối đa 100 điểm/request (phản hồi ~200ms).
 */
const matchChunkWithMapbox = async (chunk, mapboxToken, options = {}) => {
    if (!mapboxToken) return null;
    try {
        const coordsStr = chunk.map((p) => `${p.lon.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
        // Bán kính 38m: đủ bao trọn đường đôi/mặt đê rộng như Đ. Nguyễn Khoái mà không hút văng qua dãy phố khác
        const radiuses = chunk.map(() => '38').join(';');
        const url = `https://api.mapbox.com/matching/v5/mapbox/driving/${coordsStr}?geometries=geojson&overview=full&tidy=true&radiuses=${radiuses}&access_token=${mapboxToken}`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4500);
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

// OSRM public demo server chỉ cho phép <= 10 điểm mỗi lần match
const matchChunkWithOsrmSmall = async (chunk, options = {}) => {
    if (chunk.length > 10) return null;
    try {
        const coordsStr = chunk.map((p) => `${p.lon.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
        const radiuses = chunk.map(() => '25').join(';');
        const url = `https://router.project-osrm.org/match/v1/driving/${coordsStr}?geometries=geojson&overview=full&radiuses=${radiuses}&gaps=split&tidy=true`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);
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

const getBearingDeg = (p1, p2) => {
    const lat1 = ((p1[0] ?? p1.lat) * Math.PI) / 180;
    const lon1 = ((p1[1] ?? p1.lon) * Math.PI) / 180;
    const lat2 = ((p2[0] ?? p2.lat) * Math.PI) / 180;
    const lon2 = ((p2[1] ?? p2.lon) * Math.PI) / 180;
    const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};

/**
 * Sửa chữa các "gai nhọn / dốc quay đầu lệch nhà dân" do dữ liệu OSM/Mapbox lệch với Google Maps:
 * 1. Cắt bỏ gai cụt quay đầu trên cùng 1 đường (chord <= 14m) nếu xe thực tế không đi tới đó.
 * 2. Nếu phát hiện đỉnh nhọn gập góc >= 125° xa mọi điểm GPS thực tế (> 30m) — ví dụ dốc đê OSM vẽ xuyên nhà dân —
 *    tự động gọi Goong (vehicle=bike, dữ liệu chuẩn Google Maps VN) để uốn lại đúng ngõ/đường thật!
 */
const healUnvisitedSpikes = async (polyline, realPoints) => {
    if (!polyline || polyline.length < 4 || !realPoints || !realPoints.length) return polyline;

    const minDistToRealGps = (coord) => {
        let best = Infinity;
        for (let r = 0; r < realPoints.length; r++) {
            const d = distanceM(coord, realPoints[r]);
            if (d < best) {
                best = d;
                if (best < 18) return best;
            }
        }
        return best;
    };

    const coords = polyline.slice();

    // Pass 1: Cắt gai cụt hẹp trên cùng 1 làn đường (chord <= 14m)
    for (let pass = 0; pass < 2; pass++) {
        let changed = false;
        for (let i = 0; i < coords.length - 2; i++) {
            const maxJ = Math.min(coords.length - 1, i + 25);
            let cutToJ = -1;
            for (let j = maxJ; j >= i + 2; j--) {
                const chord = distanceM(coords[i], coords[j]);
                if (chord > 14) continue;

                let loopLen = 0;
                let peakDist = 0;
                let peakCoord = null;
                for (let k = i + 1; k <= j; k++) {
                    loopLen += distanceM(coords[k - 1], coords[k]);
                    if (k < j) {
                        const dEnds = Math.min(distanceM(coords[i], coords[k]), distanceM(coords[j], coords[k]));
                        if (dEnds > peakDist) {
                            peakDist = dEnds;
                            peakCoord = coords[k];
                        }
                    }
                }
                if (peakCoord && peakDist > 25 && loopLen > 60 && minDistToRealGps(peakCoord) > 30) {
                    cutToJ = j;
                    break;
                }
            }
            if (cutToJ > i + 1) {
                coords.splice(i + 1, cutToJ - i - 1);
                changed = true;
            }
        }
        if (!changed) break;
    }

    // Pass 2: Hàn gắn đỉnh nhọn lệch bản đồ (góc gập >= 125° mà xe không hề đi tới đỉnh nhọn đó) bằng Goong xe máy
    let repairs = 0;
    for (let k = 1; k < coords.length - 1 && repairs < 5; k++) {
        if (minDistToRealGps(coords[k]) <= 28) continue;

        // Tìm điểm trước và sau cách đỉnh k ít nhất 12m để tính góc gập thực sự
        let prevIdx = k - 1;
        while (prevIdx > 0 && distanceM(coords[prevIdx], coords[k]) < 12) prevIdx--;
        let nextIdx = k + 1;
        while (nextIdx < coords.length - 1 && distanceM(coords[k], coords[nextIdx]) < 12) nextIdx++;

        if (distanceM(coords[prevIdx], coords[k]) < 10 || distanceM(coords[k], coords[nextIdx]) < 10) continue;

        const bIn = getBearingDeg(coords[prevIdx], coords[k]);
        const bOut = getBearingDeg(coords[k], coords[nextIdx]);
        let diff = Math.abs(bOut - bIn);
        if (diff > 180) diff = 360 - diff;

        if (diff >= 125) {
            // Mở rộng ra 2 đầu ~80-120m để Goong định tuyến lại vào đúng ngõ thật trên Google Maps
            let startIdx = prevIdx;
            let accBack = distanceM(coords[startIdx], coords[k]);
            while (startIdx > 0 && accBack < 110) {
                accBack += distanceM(coords[startIdx - 1], coords[startIdx]);
                startIdx--;
            }

            let endIdx = nextIdx;
            let accFwd = distanceM(coords[k], coords[endIdx]);
            while (endIdx < coords.length - 1 && accFwd < 110) {
                accFwd += distanceM(coords[endIdx], coords[endIdx + 1]);
                endIdx++;
            }

            const pA = coords[startIdx];
            const pB = coords[endIdx];
            const directAB = distanceM(pA, pB);
            const goongSeg = await fetchGoongBikeRoute(pA[0], pA[1], pB[0], pB[1]);

            if (goongSeg && goongSeg.length >= 2 && polylineLengthM(goongSeg) <= Math.max(500, directAB * 5)) {
                coords.splice(startIdx, endIdx - startIdx + 1, ...goongSeg);
                repairs++;
                k = startIdx + goongSeg.length - 1;
            }
        }
    }

    return coords;
};

const matchSingleChunk = async (chunk, mapboxToken, options = {}) => {
    // 1. Ưu tiên Mapbox Matching (nhanh ~200ms, hỗ trợ 75 điểm/chunk, radius 25m chuẩn xác)
    let matched = null;
    if (mapboxToken) {
        matched = await matchChunkWithMapbox(chunk, mapboxToken, options);
    }

    // 2. Fallback OSRM nếu chunk nhỏ
    if (!matched && chunk.length <= 10) {
        matched = await matchChunkWithOsrmSmall(chunk, options);
    }

    // 3. Nếu đi trong ngõ nhỏ chưa có trên Mapbox/OSM -> định tuyến bằng Goong xe máy
    if (!matched || matched.length < 2) {
        matched = await routeChunkWithRoads(chunk, options);
    }

    return matched && matched.length > 0 ? matched : null;
};

export const snapRouteToRoads = async (points, options = {}) => {
    if (!points || points.length < 2) {
        return (points || []).map((p) => [p.lat, p.lon]);
    }

    const cleanedPoints = filterStationaryAndJumps(points, 12, 160);
    if (cleanedPoints.length < 2) {
        return cleanedPoints.map((p) => [p.lat, p.lon]);
    }

    const mapboxToken = (options.mapboxToken || process.env.NEXT_PUBLIC_MAPBOX_API_KEY || '').trim();
    // CHUNK_SIZE = 70: giữ nguyên 100% điểm cua rẽ thực tế mà chỉ cần rất ít request
    const CHUNK_SIZE = 70;
    const chunks = [];

    for (let i = 0; i < cleanedPoints.length; i += CHUNK_SIZE - 1) {
        const chunk = cleanedPoints.slice(i, i + CHUNK_SIZE);
        if (chunk.length >= 2) {
            chunks.push(chunk);
        }
    }

    if (!chunks.length) {
        return cleanedPoints.map((p) => [p.lat, p.lon]);
    }

    // Chạy song song 3 chunks cùng lúc để tốc độ nhanh gấp nhiều lần trên lộ trình dài
    const CONCURRENCY = 3;
    const matchedChunks = new Array(chunks.length);
    let completed = 0;
    let nextIndex = 0;

    const worker = async () => {
        while (nextIndex < chunks.length) {
            const idx = nextIndex++;
            matchedChunks[idx] = await matchSingleChunk(chunks[idx], mapboxToken, options);
            completed++;
            if (typeof options.onProgress === 'function') {
                const pct = Math.min(100, Math.round((completed / chunks.length) * 100));
                options.onProgress(pct);
            }
        }
    };

    await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, chunks.length) }, () => worker())
    );

    const roadPolyline = [];
    for (let i = 0; i < matchedChunks.length; i++) {
        let matched = matchedChunks[i];
        if (!matched || matched.length === 0) continue;

        if (roadPolyline.length > 0) {
            const last = roadPolyline[roadPolyline.length - 1];
            const first = matched[0];
            const gap = distanceM(last, first);

            if (gap > 20) {
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

    const finalPoly = await healUnvisitedSpikes(roadPolyline, cleanedPoints);

    return finalPoly.length >= 2 ? finalPoly : cleanedPoints.map((p) => [p.lat, p.lon]);
};
