/**
 * trajectorySimplifier.js
 * Thuat toan don gian hoa quy dao GPS thich ung (Adaptive Spatio-Temporal Decimation)
 * Ket hop Ramer-Douglas-Peucker (RDP) voi phat hien goc re (Turning Angles)
 * va gom cum dung yen/troi song (Stationary Drift Clustering).
 */

const METERS_PER_DEGREE_LATITUDE = 111320;

/**
 * Tinh khoang cach theo met giua hai toa do (dang [lat, lon] hoac {lat, lon})
 */
export const calculateDistanceMeters = (firstPoint, secondPoint) => {
    if (!firstPoint || !secondPoint) return 0;
    const latitudeStart = firstPoint.lat ?? firstPoint[0];
    const longitudeStart = firstPoint.lon ?? firstPoint[1];
    const latitudeEnd = secondPoint.lat ?? secondPoint[0];
    const longitudeEnd = secondPoint.lon ?? secondPoint[1];

    if (
        latitudeStart == null ||
        longitudeStart == null ||
        latitudeEnd == null ||
        longitudeEnd == null
    ) {
        return 0;
    }

    const deltaLatitude = (latitudeEnd - latitudeStart) * METERS_PER_DEGREE_LATITUDE;
    const meanLatitudeRadians = ((latitudeStart + latitudeEnd) * Math.PI) / 360;
    const deltaLongitude =
        (longitudeEnd - longitudeStart) *
        METERS_PER_DEGREE_LATITUDE *
        Math.cos(meanLatitudeRadians);

    return Math.sqrt(deltaLatitude * deltaLatitude + deltaLongitude * deltaLongitude);
};

/**
 * Tinh goc phuong vi (Azimuth Bearing 0-360 do) giua hai diem
 */
export const calculateBearingDegrees = (firstPoint, secondPoint) => {
    const latitudeStartRad = (((firstPoint.lat ?? firstPoint[0]) || 0) * Math.PI) / 180;
    const longitudeStartRad = (((firstPoint.lon ?? firstPoint[1]) || 0) * Math.PI) / 180;
    const latitudeEndRad = (((secondPoint.lat ?? secondPoint[0]) || 0) * Math.PI) / 180;
    const longitudeEndRad = (((secondPoint.lon ?? secondPoint[1]) || 0) * Math.PI) / 180;

    const deltaLongitude = longitudeEndRad - longitudeStartRad;
    const coordinateY = Math.sin(deltaLongitude) * Math.cos(latitudeEndRad);
    const coordinateX =
        Math.cos(latitudeStartRad) * Math.sin(latitudeEndRad) -
        Math.sin(latitudeStartRad) * Math.cos(latitudeEndRad) * Math.cos(deltaLongitude);

    return ((Math.atan2(coordinateY, coordinateX) * 180) / Math.PI + 360) % 360;
};

/**
 * Tinh do lech goc tuyet doi giua hai huong (0 - 180 do)
 */
export const calculateBearingDeltaDegrees = (bearingSource, bearingTarget) => {
    let angularDifference = Math.abs(bearingTarget - bearingSource);
    if (angularDifference > 180) {
        angularDifference = 360 - angularDifference;
    }
    return angularDifference;
};

/**
 * Tinh khoang cach vuong goc (cross-track distance) tu diem den doan thang
 */
export const calculateCrossTrackDistanceMeters = (
    candidatePoint,
    segmentStartPoint,
    segmentEndPoint
) => {
    const segmentLengthMeters = calculateDistanceMeters(segmentStartPoint, segmentEndPoint);
    if (segmentLengthMeters < 1e-4) {
        return calculateDistanceMeters(candidatePoint, segmentStartPoint);
    }

    const latitudeCandidate = candidatePoint.lat ?? candidatePoint[0];
    const longitudeCandidate = candidatePoint.lon ?? candidatePoint[1];
    const latitudeStart = segmentStartPoint.lat ?? segmentStartPoint[0];
    const longitudeStart = segmentStartPoint.lon ?? segmentStartPoint[1];
    const latitudeEnd = segmentEndPoint.lat ?? segmentEndPoint[0];
    const longitudeEnd = segmentEndPoint.lon ?? segmentEndPoint[1];

    const meanLatitudeRadians = ((latitudeStart + latitudeEnd) * Math.PI) / 360;
    const metersPerDegreeLon = METERS_PER_DEGREE_LATITUDE * Math.cos(meanLatitudeRadians);

    const deltaX = (longitudeEnd - longitudeStart) * metersPerDegreeLon;
    const deltaY = (latitudeEnd - latitudeStart) * METERS_PER_DEGREE_LATITUDE;

    const candidateX = (longitudeCandidate - longitudeStart) * metersPerDegreeLon;
    const candidateY = (latitudeCandidate - latitudeStart) * METERS_PER_DEGREE_LATITUDE;

    const projectionRatio =
        (candidateX * deltaX + candidateY * deltaY) /
        (segmentLengthMeters * segmentLengthMeters);
    const clampedRatio = Math.max(0, Math.min(1, projectionRatio));

    const projectedX = clampedRatio * deltaX;
    const projectedY = clampedRatio * deltaY;

    const distanceX = candidateX - projectedX;
    const distanceY = candidateY - projectedY;

    return Math.sqrt(distanceX * distanceX + distanceY * distanceY);
};

const isTelemetryStationary = (telemetryPoint) => {
    if (!telemetryPoint) return true;
    if (telemetryPoint.statusType === 'PARK' || Number(telemetryPoint.acc) === 1) return true;
    const measuredSpeed = Math.max(
        Number(telemetryPoint.spd ?? 0) || 0,
        Number(telemetryPoint.velocityNum ?? 0) || 0,
        Number(telemetryPoint.vgp ?? 0) || 0
    );
    return measuredSpeed <= 2.5;
};

/**
 * Loc nhiễu troi GPS trong nha / dung xe va cac buoc nhay ping-pong dot ngot
 */
export const filterStationaryAndJumps = (
    pointsArray,
    minMovingDistanceMeters = 12,
    maxJumpDistanceMeters = 160
) => {
    if (!pointsArray || pointsArray.length < 2) return pointsArray || [];
    const validPoints = pointsArray.filter(
        (point) =>
            point &&
            typeof (point.lat ?? point[0]) === 'number' &&
            typeof (point.lon ?? point[1]) === 'number' &&
            !isNaN(point.lat ?? point[0]) &&
            !isNaN(point.lon ?? point[1])
    );
    if (validPoints.length < 2) return validPoints;

    // Giai doan 1: Gom cum dung yen / tat may theo mo neo stationaryAnchor
    const stage1Filtered = [];
    let stationaryAnchorPoint = null;

    for (let index = 0; index < validPoints.length; index++) {
        const currentPoint = validPoints[index];
        const isParked = currentPoint.statusType === 'PARK' || Number(currentPoint.acc) === 1;
        const isStationary = isTelemetryStationary(currentPoint);

        if (stage1Filtered.length === 0) {
            stage1Filtered.push(currentPoint);
            if (isStationary) stationaryAnchorPoint = currentPoint;
            continue;
        }

        const previousPoint = stage1Filtered[stage1Filtered.length - 1];
        const distanceFromPrevious = calculateDistanceMeters(previousPoint, currentPoint);

        if (isStationary) {
            if (!stationaryAnchorPoint) stationaryAnchorPoint = previousPoint;
            const distanceFromAnchor = calculateDistanceMeters(stationaryAnchorPoint, currentPoint);
            const anchorRadiusMeters = isParked ? 220 : 80;
            if (
                distanceFromAnchor < anchorRadiusMeters ||
                distanceFromPrevious < minMovingDistanceMeters
            ) {
                continue;
            }
            if (distanceFromPrevious > maxJumpDistanceMeters) {
                continue;
            }
            stationaryAnchorPoint = currentPoint;
        } else {
            stationaryAnchorPoint = null;
            if (distanceFromPrevious < 4) continue;
            const measuredSpeed = Number(currentPoint.spd ?? currentPoint.velocityNum ?? 0) || 0;
            if (distanceFromPrevious > maxJumpDistanceMeters && measuredSpeed <= 5) continue;
        }

        stage1Filtered.push(currentPoint);
    }

    // Giai doan 2: Loai bo cac diem nhay ping-pong dot bien
    const cleanedOutput = [stage1Filtered[0]];
    let cursorIndex = 1;
    while (cursorIndex < stage1Filtered.length - 1) {
        const previousKept = cleanedOutput[cleanedOutput.length - 1];
        const currentCandidate = stage1Filtered[cursorIndex];
        const distanceStep = calculateDistanceMeters(previousKept, currentCandidate);
        const isStationary = isTelemetryStationary(currentCandidate);

        if (distanceStep > 35) {
            let returnIndex = -1;
            const maxLookAhead = isStationary ? 5 : 2;
            for (
                let lookStep = 1;
                lookStep <= maxLookAhead && cursorIndex + lookStep < stage1Filtered.length;
                lookStep++
            ) {
                const lookAheadPoint = stage1Filtered[cursorIndex + lookStep];
                const distanceLookAhead = calculateDistanceMeters(previousKept, lookAheadPoint);
                const thresholdRatio = isStationary ? 0.8 : 0.45;
                if (distanceLookAhead < Math.min(distanceStep * thresholdRatio, 55)) {
                    returnIndex = cursorIndex + lookStep;
                    break;
                }
            }
            if (returnIndex !== -1) {
                cursorIndex = returnIndex;
                continue;
            }
        }

        cleanedOutput.push(currentCandidate);
        cursorIndex++;
    }

    if (stage1Filtered.length > 1) {
        const lastRawPoint = stage1Filtered[stage1Filtered.length - 1];
        const lastKeptPoint = cleanedOutput[cleanedOutput.length - 1];
        if (calculateDistanceMeters(lastKeptPoint, lastRawPoint) >= 5) {
            cleanedOutput.push(lastRawPoint);
        }
    }

    return cleanedOutput;
};

/**
 * Ramer-Douglas-Peucker de quy giu cac moc quy dao quan trong
 */
const runRdpRecursive = (pointsList, startIndex, endIndex, epsilonThresholdMeters, markedIndices) => {
    let maximumDistance = 0;
    let furthestIndex = startIndex;

    for (let candidateIdx = startIndex + 1; candidateIdx < endIndex; candidateIdx++) {
        const perpendicularDistance = calculateCrossTrackDistanceMeters(
            pointsList[candidateIdx],
            pointsList[startIndex],
            pointsList[endIndex]
        );
        if (perpendicularDistance > maximumDistance) {
            maximumDistance = perpendicularDistance;
            furthestIndex = candidateIdx;
        }
    }

    if (maximumDistance > epsilonThresholdMeters) {
        markedIndices.add(furthestIndex);
        runRdpRecursive(pointsList, startIndex, furthestIndex, epsilonThresholdMeters, markedIndices);
        runRdpRecursive(pointsList, furthestIndex, endIndex, epsilonThresholdMeters, markedIndices);
    }
};

/**
 * Don gian hoa thich ung: giu goc re (Turning Angles), diem dung, va RDP
 * Nén 4000+ diem xuong ~120-180 diem chuan xac tuyet doi ve hinh hoc duong.
 */
export const simplifyTrajectoryAdaptive = (telemetryPoints, configurationOptions = {}) => {
    if (!telemetryPoints || telemetryPoints.length < 3) return telemetryPoints || [];

    const epsilonThresholdMeters = configurationOptions.epsilonMeters || 12;
    const minimumTurnAngleDegrees = configurationOptions.minTurnAngleDeg || 12;
    const maximumPointGapMeters = configurationOptions.maxGapMeters || 260;

    const markedIndicesSet = new Set([0, telemetryPoints.length - 1]);

    // 1. Danh dau tat ca cac diem co goc re / ngo re (|delta theta| >= 12 do)
    for (let pointIdx = 1; pointIdx < telemetryPoints.length - 1; pointIdx++) {
        const previousPt = telemetryPoints[pointIdx - 1];
        const currentPt = telemetryPoints[pointIdx];
        const nextPt = telemetryPoints[pointIdx + 1];

        const bearingIncoming = calculateBearingDegrees(previousPt, currentPt);
        const bearingOutgoing = calculateBearingDegrees(currentPt, nextPt);
        const bearingDelta = calculateBearingDeltaDegrees(bearingIncoming, bearingOutgoing);

        if (bearingDelta >= minimumTurnAngleDegrees) {
            markedIndicesSet.add(pointIdx);
        }
    }

    // 2. Chay RDP tren toan bo quy dao de giu do vong cua cac cung duong
    runRdpRecursive(
        telemetryPoints,
        0,
        telemetryPoints.length - 1,
        epsilonThresholdMeters,
        markedIndicesSet
    );

    // 3. Dam bao khoang cach giua hai moc ke tiep khong vuot qua maximumPointGapMeters
    const sortedIndices = Array.from(markedIndicesSet).sort((a, b) => a - b);
    const finalKeptIndices = [sortedIndices[0]];

    for (let i = 1; i < sortedIndices.length; i++) {
        const previousIndex = finalKeptIndices[finalKeptIndices.length - 1];
        const currentIndex = sortedIndices[i];
        const segmentDistance = calculateDistanceMeters(
            telemetryPoints[previousIndex],
            telemetryPoints[currentIndex]
        );

        if (segmentDistance > maximumPointGapMeters) {
            const intermediateSteps = Math.ceil(segmentDistance / maximumPointGapMeters);
            const indexStep = Math.max(1, Math.floor((currentIndex - previousIndex) / intermediateSteps));
            for (let subIdx = previousIndex + indexStep; subIdx < currentIndex; subIdx += indexStep) {
                finalKeptIndices.push(subIdx);
            }
        }
        finalKeptIndices.push(currentIndex);
    }

    return finalKeptIndices.map((selectedIdx) => telemetryPoints[selectedIdx]);
};
