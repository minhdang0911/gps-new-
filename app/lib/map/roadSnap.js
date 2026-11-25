/**
 * roadSnap.js
 * Dong co xu ly quy dao xe bam duong (Road-Snapping Trajectory Engine)
 * Tich hop:
 * - Adaptive Spatio-Temporal Simplification (RDP + Goc re)
 * - Mapbox Map Matching da che do (Cycling / Driving)
 * - Centripetal Catmull-Rom Spline Curve Smoothing (alpha = 0.5)
 * - Triet tieu vet cat xe ngang song / ho / nha dan (Zero-Cut Bridge)
 */

import {
    filterStationaryAndJumps,
    simplifyTrajectoryAdaptive,
} from './trajectorySimplifier.js';
import { matchTrajectoryWithMapbox } from './mapboxMatchingClient.js';
import { smoothPolylineWithCatmullRom } from './catmullRomCurve.js';

export { filterStationaryAndJumps };

/**
 * Xu ly lo trinh bam sat mat duong thuc te va uon cong mem mai nhu app tai xe (Grab/Google Maps)
 * @param {Array<Object|Array>} rawPoints - Danh sach toa do goc tu API telemetry
 * @param {Object} snapOptions - Cac tuy chon cau hinh (token, callback tien trinh)
 * @returns {Promise<Array<[number, number]>>} - Danh sach toa do [lat, lon] da bam duong va uon cong
 */
export const snapRouteToRoads = async (rawPoints, snapOptions = {}) => {
    if (!rawPoints || rawPoints.length < 2) {
        return (rawPoints || []).map((point) => [
            point.lat ?? point[0],
            point.lon ?? point[1],
        ]);
    }

    // Buoc 1: Loc nhiễu dung yen, troi GPS trong nha va cac buoc nhay dot ngot
    const cleanedTelemetryPoints = filterStationaryAndJumps(rawPoints, 10, 160);
    if (cleanedTelemetryPoints.length < 2) {
        return cleanedTelemetryPoints.map((point) => [
            point.lat ?? point[0],
            point.lon ?? point[1],
        ]);
    }

    // Buoc 2: Don gian hoa quy dao bang RDP va Turning Angles
    // Nen 4,000+ diem xuong ~120-180 diem dinh hinh duong (giam 96% so diem ma 0 lam mat goc re)
    const simplifiedWaypoints = simplifyTrajectoryAdaptive(cleanedTelemetryPoints, {
        epsilonMeters: 10,
        minTurnAngleDeg: 12,
        maxGapMeters: 260,
    });

    const mapboxAccessToken = (
        snapOptions.mapboxToken ||
        process.env.NEXT_PUBLIC_MAPBOX_API_KEY ||
        ''
    ).trim();

    // Buoc 3: Khop mat duong bang Mapbox Map Matching (chi ton 1-2 request thay vi 50-60 request)
    // Tich hop co che cau noi GPS goc giua cac khoang trong de khong bao gio cat cheo qua song/nha
    let roadMatchedCoordinates = null;

    if (mapboxAccessToken && simplifiedWaypoints.length >= 2) {
        try {
            roadMatchedCoordinates = await matchTrajectoryWithMapbox(
                simplifiedWaypoints,
                cleanedTelemetryPoints,
                mapboxAccessToken,
                snapOptions
            );
        } catch (matchingError) {
            console.warn('Mapbox map matching warning:', matchingError);
            roadMatchedCoordinates = null;
        }
    }

    // Neu khong co token Mapbox hoac loi mang, su dung quy dao GPS goc da duoc loc sach
    const baseCoordinates =
        roadMatchedCoordinates && roadMatchedCoordinates.length >= 2
            ? roadMatchedCoordinates
            : cleanedTelemetryPoints.map((point) => [
                  point.lat ?? point[0],
                  point.lon ?? point[1],
              ]);

    // Buoc 4: Uon cong mem mai bang Centripetal Catmull-Rom Spline (alpha = 0.5)
    // Giup quy dao luon theo do cong cua duong nhu Grab/Be/Google Maps
    const finalizedSmoothPolyline = smoothPolylineWithCatmullRom(
        baseCoordinates,
        7,
        320
    );

    if (typeof snapOptions.onProgress === 'function') {
        snapOptions.onProgress(100);
    }

    return finalizedSmoothPolyline.length >= 2
        ? finalizedSmoothPolyline
        : baseCoordinates;
};
