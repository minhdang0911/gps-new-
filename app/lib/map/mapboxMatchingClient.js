/**
 * mapboxMatchingClient.js
 * Client Mapbox Map Matching API danh rieng cho ha tang giao thong Viet Nam.
 * - Su dung profile cycling (xe may/xe dien) khop chuan cac duong de, ngo nho nhu de Song Nhue
 * - Chia chunk 80 diem / request (chi ton 1-2 request cho toan bo lo trinh 24h)
 * - Cau noi GPS goc theo trinh tu thoi gian thuan chieu (Chronological Forward Bridge)
 *   triet tieu hoan toan cac vet cat xe cheo qua song, pho hay nha dan.
 */

import { smoothPolylineWithCatmullRom } from './catmullRomCurve.js';
import { calculateDistanceMeters } from './trajectorySimplifier.js';

// Cache trong bo nho RAM de phan hoi 0ms khi tua slider hoac xem lai
const trajectoryMatchingCacheMap = new Map();
const MAXIMUM_CACHE_ENTRIES = 50;

/**
 * Tao ma van tay duy nhat cho tap diem quy dao
 */
export const buildTrajectoryCacheKey = (telemetryPoints) => {
    if (!telemetryPoints || telemetryPoints.length === 0) return '';
    const firstPoint = telemetryPoints[0];
    const middlePoint = telemetryPoints[Math.floor(telemetryPoints.length / 2)];
    const lastPoint = telemetryPoints[telemetryPoints.length - 1];

    const firstLat = (firstPoint.lat ?? firstPoint[0] ?? 0).toFixed(5);
    const firstLon = (firstPoint.lon ?? firstPoint[1] ?? 0).toFixed(5);
    const middleLat = (middlePoint.lat ?? middlePoint[0] ?? 0).toFixed(5);
    const middleLon = (middlePoint.lon ?? middlePoint[1] ?? 0).toFixed(5);
    const lastLat = (lastPoint.lat ?? lastPoint[0] ?? 0).toFixed(5);
    const lastLon = (lastPoint.lon ?? lastPoint[1] ?? 0).toFixed(5);

    return `${firstLat}_${firstLon}_${middleLat}_${middleLon}_${lastLat}_${lastLon}_${telemetryPoints.length}`;
};

/**
 * Tim chi so gan nhat trong mang GPS goc theo thu tu thoi gian tien ve phia truoc
 * Tranh tuyet doi viec nham lan voi cac cung duong xe da chay qua vao gio khac.
 */
const findNearestChronologicalIndex = (targetCoordinate, densePoints, minimumStartIndex = 0) => {
    if (!densePoints || densePoints.length === 0) return 0;
    const boundedStartIndex = Math.max(0, Math.min(minimumStartIndex, densePoints.length - 1));

    let optimalIndex = boundedStartIndex;
    let shortestDistanceMeters = Infinity;

    // Uu tien tim kiem trong pham vi thuan chieu thoi gian
    for (let i = boundedStartIndex; i < densePoints.length; i++) {
        const pointCandidate = densePoints[i];
        const distanceToTarget = calculateDistanceMeters(targetCoordinate, pointCandidate);
        if (distanceToTarget < shortestDistanceMeters) {
            shortestDistanceMeters = distanceToTarget;
            optimalIndex = i;
            if (shortestDistanceMeters < 12) break;
        }
    }

    return optimalIndex;
};

/**
 * Goi Mapbox Map Matching API cho 1 chunk toa do
 */
const requestMapboxMatchingChunk = async (
    chunkPoints,
    mapboxAccessToken,
    routingProfile = 'cycling',
    matchingRadiusMeters = 32
) => {
    if (!mapboxAccessToken || !chunkPoints || chunkPoints.length < 2) return null;

    try {
        const coordinatesQueryString = chunkPoints
            .map((pt) => {
                const longitude = Number(pt.lon ?? pt[1] ?? 0).toFixed(6);
                const latitude = Number(pt.lat ?? pt[0] ?? 0).toFixed(6);
                return `${longitude},${latitude}`;
            })
            .join(';');

        const radiusQueryString = chunkPoints.map(() => String(matchingRadiusMeters)).join(';');
        const requestUrl = `https://api.mapbox.com/matching/v5/mapbox/${routingProfile}/${coordinatesQueryString}?geometries=geojson&overview=full&tidy=true&radiuses=${radiusQueryString}&access_token=${mapboxAccessToken}`;

        const abortController = new AbortController();
        const timeoutHandle = setTimeout(() => abortController.abort(), 4500);

        const response = await fetch(requestUrl, { signal: abortController.signal });
        clearTimeout(timeoutHandle);

        if (!response.ok) return null;
        const responseJson = await response.json();

        if (responseJson.code === 'Ok' && Array.isArray(responseJson.matchings) && responseJson.matchings.length > 0) {
            return responseJson.matchings;
        }
        return null;
    } catch (_) {
        return null;
    }
};

/**
 * Trich xuat doan GPS goc theo trinh tu thoi gian giua 2 toa do moc de lap khoang trong
 */
const buildChronologicalBridgePoints = (
    bridgeStartCoordinate,
    bridgeEndCoordinate,
    denseSourcePoints,
    chronologicalCursorRef
) => {
    if (!denseSourcePoints || denseSourcePoints.length < 2) {
        return [bridgeStartCoordinate, bridgeEndCoordinate];
    }

    const currentCursor = chronologicalCursorRef?.cursor || 0;
    const startPointIndex = findNearestChronologicalIndex(
        bridgeStartCoordinate,
        denseSourcePoints,
        currentCursor
    );
    const endPointIndex = findNearestChronologicalIndex(
        bridgeEndCoordinate,
        denseSourcePoints,
        startPointIndex
    );

    if (chronologicalCursorRef) {
        chronologicalCursorRef.cursor = endPointIndex;
    }

    if (endPointIndex > startPointIndex) {
        const rawPointsSegment = denseSourcePoints
            .slice(startPointIndex, endPointIndex + 1)
            .map((pt) => [pt.lat ?? pt[0], pt.lon ?? pt[1]]);
        if (rawPointsSegment.length >= 2) {
            return smoothPolylineWithCatmullRom(rawPointsSegment, 7, 300);
        }
    }

    return [bridgeStartCoordinate, bridgeEndCoordinate];
};

/**
 * Noi cac doan sub-matching va lap cac khoang trong bang du lieu GPS goc duoc uon cong
 */
const stitchSubMatchingsWithDenseFallback = (subMatchings, denseSourcePoints, cursorRef) => {
    if (!subMatchings || subMatchings.length === 0) return [];
    const stitchedCoordinates = [];

    for (let matchIdx = 0; matchIdx < subMatchings.length; matchIdx++) {
        const matchingItem = subMatchings[matchIdx];
        const rawCoords = matchingItem.geometry?.coordinates?.map((c) => [c[1], c[0]]) || [];
        if (rawCoords.length === 0) continue;

        if (stitchedCoordinates.length > 0) {
            const previousEndpoint = stitchedCoordinates[stitchedCoordinates.length - 1];
            const currentStartPoint = rawCoords[0];
            const gapDistanceMeters = calculateDistanceMeters(previousEndpoint, currentStartPoint);

            // Lap khoang trong bang chinh GPS thuc te xe da chay qua thay vi cat cheo
            if (gapDistanceMeters > 15) {
                const bridgeSegment = buildChronologicalBridgePoints(
                    previousEndpoint,
                    currentStartPoint,
                    denseSourcePoints,
                    cursorRef
                );
                if (bridgeSegment.length >= 2) {
                    stitchedCoordinates.push(...bridgeSegment.slice(1, -1));
                }
            }
        }

        if (stitchedCoordinates.length > 0 && rawCoords.length > 0) {
            const previousEndpoint = stitchedCoordinates[stitchedCoordinates.length - 1];
            const currentStartPoint = rawCoords[0];
            if (calculateDistanceMeters(previousEndpoint, currentStartPoint) < 1) {
                stitchedCoordinates.push(...rawCoords.slice(1));
            } else {
                stitchedCoordinates.push(...rawCoords);
            }
        } else {
            stitchedCoordinates.push(...rawCoords);
        }
    }

    return stitchedCoordinates;
};

/**
 * Khop toan bo quy dao xe bang Mapbox Map Matching voi co che Fallback da tang
 */
export const matchTrajectoryWithMapbox = async (
    simplifiedWaypoints,
    denseSourcePoints,
    mapboxAccessToken,
    matchingOptions = {}
) => {
    if (!simplifiedWaypoints || simplifiedWaypoints.length < 2) {
        return (denseSourcePoints || []).map((pt) => [pt.lat ?? pt[0], pt.lon ?? pt[1]]);
    }

    // Kiem tra bo nho cache
    const cacheIdentifier = buildTrajectoryCacheKey(simplifiedWaypoints);
    if (cacheIdentifier && trajectoryMatchingCacheMap.has(cacheIdentifier)) {
        return trajectoryMatchingCacheMap.get(cacheIdentifier);
    }

    const CHUNK_CAPACITY = 80;
    const waypointChunks = [];

    for (let chunkStart = 0; chunkStart < simplifiedWaypoints.length; chunkStart += CHUNK_CAPACITY - 1) {
        const singleChunk = simplifiedWaypoints.slice(chunkStart, chunkStart + CHUNK_CAPACITY);
        if (singleChunk.length >= 2) {
            waypointChunks.push(singleChunk);
        }
    }

    if (waypointChunks.length === 0) {
        return (denseSourcePoints || []).map((pt) => [pt.lat ?? pt[0], pt.lon ?? pt[1]]);
    }

    const matchedChunkResults = new Array(waypointChunks.length);
    let completedChunksCount = 0;

    const processChunk = async (chunkIndex) => {
        const currentChunk = waypointChunks[chunkIndex];
        const cursorTracker = { cursor: 0 };

        // 1. Uu tien profile cycling (chuan duong de, ngo ngach xe may/EV VN)
        let subMatchings = await requestMapboxMatchingChunk(
            currentChunk,
            mapboxAccessToken,
            'cycling',
            32
        );

        // 2. Fallback sang driving neu cycling khong khop
        if (!subMatchings) {
            subMatchings = await requestMapboxMatchingChunk(
                currentChunk,
                mapboxAccessToken,
                'driving',
                35
            );
        }

        if (subMatchings && subMatchings.length > 0) {
            matchedChunkResults[chunkIndex] = stitchSubMatchingsWithDenseFallback(
                subMatchings,
                denseSourcePoints,
                cursorTracker
            );
        } else {
            // Neu ca hai khong khop, lay cac diem GPS goc tuong ung uon cong Catmull-Rom
            const chunkFirstPt = currentChunk[0];
            const chunkLastPt = currentChunk[currentChunk.length - 1];
            const bridgeSegment = buildChronologicalBridgePoints(
                [chunkFirstPt.lat ?? chunkFirstPt[0], chunkFirstPt.lon ?? chunkFirstPt[1]],
                [chunkLastPt.lat ?? chunkLastPt[0], chunkLastPt.lon ?? chunkLastPt[1]],
                denseSourcePoints,
                cursorTracker
            );
            matchedChunkResults[chunkIndex] = bridgeSegment;
        }

        completedChunksCount++;
        if (typeof matchingOptions.onProgress === 'function') {
            const progressPercent = Math.min(
                100,
                Math.round((completedChunksCount / waypointChunks.length) * 100)
            );
            matchingOptions.onProgress(progressPercent);
        }
    };

    // Chay song song cac chunk
    await Promise.all(waypointChunks.map((_, idx) => processChunk(idx)));

    // Noi tat ca cac chunk lai voi nhau theo trinh tu thoi gian
    const completePolyline = [];
    const interChunkCursorTracker = { cursor: 0 };

    for (let chunkIdx = 0; chunkIdx < matchedChunkResults.length; chunkIdx++) {
        const chunkCoords = matchedChunkResults[chunkIdx];
        if (!chunkCoords || chunkCoords.length === 0) continue;

        if (completePolyline.length > 0) {
            const previousTail = completePolyline[completePolyline.length - 1];
            const currentHead = chunkCoords[0];
            const gapDistanceMeters = calculateDistanceMeters(previousTail, currentHead);

            if (gapDistanceMeters > 15) {
                const interChunkBridge = buildChronologicalBridgePoints(
                    previousTail,
                    currentHead,
                    denseSourcePoints,
                    interChunkCursorTracker
                );
                if (interChunkBridge.length >= 2) {
                    completePolyline.push(...interChunkBridge.slice(1, -1));
                }
            } else if (gapDistanceMeters < 1) {
                completePolyline.push(...chunkCoords.slice(1));
                continue;
            }
        }
        completePolyline.push(...chunkCoords);
    }

    // Luu ket qua vao cache
    if (completePolyline.length >= 2 && cacheIdentifier) {
        if (trajectoryMatchingCacheMap.size >= MAXIMUM_CACHE_ENTRIES) {
            const oldestKey = trajectoryMatchingCacheMap.keys().next().value;
            trajectoryMatchingCacheMap.delete(oldestKey);
        }
        trajectoryMatchingCacheMap.set(cacheIdentifier, completePolyline);
    }

    return completePolyline.length >= 2
        ? completePolyline
        : (denseSourcePoints || []).map((pt) => [pt.lat ?? pt[0], pt.lon ?? pt[1]]);
};
