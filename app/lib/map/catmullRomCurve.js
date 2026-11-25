/**
 * catmullRomCurve.js
 * Thuat toan noi suy duong cong Centripetal Catmull-Rom Spline (alpha = 0.5)
 * Tao duong di mem mai, tu nhien, triet tieu goc gap sac canh nhu cac ung dung tai xe (Grab, Google Maps).
 * Khong tao vong xoan (cusp-free) va di qua dung 100% cac diem moc tren duong.
 */

const METERS_PER_DEGREE_LATITUDE = 111320;

/**
 * Tinh khoang cach met giua 2 toa do [lat, lon]
 */
const calculateCoordinateDistanceMeters = (coordinateAlpha, coordinateBeta) => {
    if (!coordinateAlpha || !coordinateBeta) return 0;
    const latitudeAlpha = coordinateAlpha[0] ?? coordinateAlpha.lat;
    const longitudeAlpha = coordinateAlpha[1] ?? coordinateAlpha.lon;
    const latitudeBeta = coordinateBeta[0] ?? coordinateBeta.lat;
    const longitudeBeta = coordinateBeta[1] ?? coordinateBeta.lon;

    const deltaLatitude = (latitudeBeta - latitudeAlpha) * METERS_PER_DEGREE_LATITUDE;
    const meanLatitudeRadians = ((latitudeAlpha + latitudeBeta) * Math.PI) / 360;
    const deltaLongitude =
        (longitudeBeta - longitudeAlpha) *
        METERS_PER_DEGREE_LATITUDE *
        Math.cos(meanLatitudeRadians);

    return Math.sqrt(deltaLatitude * deltaLatitude + deltaLongitude * deltaLongitude);
};

/**
 * Tinh toan mot doan noi suy Centripetal Catmull-Rom giua diem point1 va point2
 * voi hai diem neo can duong point0 va point3.
 */
const interpolateCatmullRomSegment = (
    pointZero,
    pointOne,
    pointTwo,
    pointThree,
    centripetalAlpha = 0.5,
    sampleStepMeters = 8
) => {
    const latZero = pointZero[0] ?? pointZero.lat;
    const lonZero = pointZero[1] ?? pointZero.lon;
    const latOne = pointOne[0] ?? pointOne.lat;
    const lonOne = pointOne[1] ?? pointOne.lon;
    const latTwo = pointTwo[0] ?? pointTwo.lat;
    const lonTwo = pointTwo[1] ?? pointTwo.lon;
    const latThree = pointThree[0] ?? pointThree.lat;
    const lonThree = pointThree[1] ?? pointThree.lon;

    const distanceZeroToOne = Math.max(
        1e-4,
        calculateCoordinateDistanceMeters([latZero, lonZero], [latOne, lonOne])
    );
    const distanceOneToTwo = Math.max(
        1e-4,
        calculateCoordinateDistanceMeters([latOne, lonOne], [latTwo, lonTwo])
    );
    const distanceTwoToThree = Math.max(
        1e-4,
        calculateCoordinateDistanceMeters([latTwo, lonTwo], [latThree, lonThree])
    );

    // Tham so hoa nut knot parameterization: t(k+1) = t(k) + distance^alpha
    const knotZero = 0;
    const knotOne = knotZero + Math.pow(distanceZeroToOne, centripetalAlpha);
    const knotTwo = knotOne + Math.pow(distanceOneToTwo, centripetalAlpha);
    const knotThree = knotTwo + Math.pow(distanceTwoToThree, centripetalAlpha);

    // Xac dinh so buoc noi suy dua tren do dai thuc te cua doan
    const interpolationSteps = Math.max(1, Math.min(25, Math.ceil(distanceOneToTwo / sampleStepMeters)));
    const segmentCoordinates = [];

    for (let stepIndex = 0; stepIndex < interpolationSteps; stepIndex++) {
        const parameterTime = knotOne + ((knotTwo - knotOne) * stepIndex) / interpolationSteps;

        // Bac 1: Tinh toan cac cap vector tuyen tinh A1, A2, A3
        const factorA1First = (knotOne - parameterTime) / (knotOne - knotZero);
        const factorA1Second = (parameterTime - knotZero) / (knotOne - knotZero);
        const latA1 = factorA1First * latZero + factorA1Second * latOne;
        const lonA1 = factorA1First * lonZero + factorA1Second * lonOne;

        const factorA2First = (knotTwo - parameterTime) / (knotTwo - knotOne);
        const factorA2Second = (parameterTime - knotOne) / (knotTwo - knotOne);
        const latA2 = factorA2First * latOne + factorA2Second * latTwo;
        const lonA2 = factorA2First * lonOne + factorA2Second * lonTwo;

        const factorA3First = (knotThree - parameterTime) / (knotThree - knotTwo);
        const factorA3Second = (parameterTime - knotTwo) / (knotThree - knotTwo);
        const latA3 = factorA3First * latTwo + factorA3Second * latThree;
        const lonA3 = factorA3First * lonTwo + factorA3Second * lonThree;

        // Bac 2: Ket hop tuyen tinh B1, B2
        const factorB1First = (knotTwo - parameterTime) / (knotTwo - knotZero);
        const factorB1Second = (parameterTime - knotZero) / (knotTwo - knotZero);
        const latB1 = factorB1First * latA1 + factorB1Second * latA2;
        const lonB1 = factorB1First * lonA1 + factorB1Second * lonA2;

        const factorB2First = (knotThree - parameterTime) / (knotThree - knotOne);
        const factorB2Second = (parameterTime - knotOne) / (knotThree - knotOne);
        const latB2 = factorB2First * latA2 + factorB2Second * latA3;
        const lonB2 = factorB2First * lonA2 + factorB2Second * lonA3;

        // Bac 3: Ket qua noi suy cuoi cung C(t)
        const factorCFirst = (knotTwo - parameterTime) / (knotTwo - knotOne);
        const factorCSecond = (parameterTime - knotOne) / (knotTwo - knotOne);
        const finalLatitude = factorCFirst * latB1 + factorCSecond * latB2;
        const finalLongitude = factorCFirst * lonB1 + factorCSecond * lonB2;

        segmentCoordinates.push([finalLatitude, finalLongitude]);
    }

    return segmentCoordinates;
};

/**
 * Lam min polyline bang Centripetal Catmull-Rom Spline
 * @param {Array} rawCoordinates - Danh sach cac toa do [lat, lon] hoac {lat, lon}
 * @param {number} sampleIntervalMeters - Khoang cach giua cac diem noi suy (mac dinh ~8m)
 * @returns {Array<[number, number]>} - Polyline da duoc uon cong mem mai
 */
export const smoothPolylineWithCatmullRom = (
    rawCoordinates,
    sampleIntervalMeters = 8,
    maxInterpolationGapMeters = 350
) => {
    if (!rawCoordinates || rawCoordinates.length < 2) {
        return (rawCoordinates || []).map((coord) => [
            coord[0] ?? coord.lat,
            coord[1] ?? coord.lon,
        ]);
    }

    // Chuan hoa toa do sang mang [latitude, longitude] va loc bo cac diem trung lap
    const normalizedPoints = [];
    for (let i = 0; i < rawCoordinates.length; i++) {
        const currentCoord = rawCoordinates[i];
        const latitude = currentCoord[0] ?? currentCoord.lat;
        const longitude = currentCoord[1] ?? currentCoord.lon;
        if (typeof latitude !== 'number' || typeof longitude !== 'number' || isNaN(latitude) || isNaN(longitude)) {
            continue;
        }

        const previousAccepted = normalizedPoints[normalizedPoints.length - 1];
        if (
            !previousAccepted ||
            calculateCoordinateDistanceMeters(previousAccepted, [latitude, longitude]) >= 0.5
        ) {
            normalizedPoints.push([latitude, longitude]);
        }
    }

    if (normalizedPoints.length < 3) {
        return normalizedPoints;
    }

    // Tao diem gia dinh o hai dau de dam bao toan bo quy dao deu duoc noi suy tron tria
    const firstPoint = normalizedPoints[0];
    const secondPoint = normalizedPoints[1];
    const penultimatePoint = normalizedPoints[normalizedPoints.length - 2];
    const lastPoint = normalizedPoints[normalizedPoints.length - 1];

    const ghostStartPoint = [
        2 * firstPoint[0] - secondPoint[0],
        2 * firstPoint[1] - secondPoint[1],
    ];
    const ghostEndPoint = [
        2 * lastPoint[0] - penultimatePoint[0],
        2 * lastPoint[1] - penultimatePoint[1],
    ];

    const extendedPoints = [ghostStartPoint, ...normalizedPoints, ghostEndPoint];
    const smoothedPolyline = [];

    for (let pointIdx = 1; pointIdx < extendedPoints.length - 2; pointIdx++) {
        const pointZero = extendedPoints[pointIdx - 1];
        const pointOne = extendedPoints[pointIdx];
        const pointTwo = extendedPoints[pointIdx + 1];
        const pointThree = extendedPoints[pointIdx + 2];

        const segmentDistance = calculateCoordinateDistanceMeters(pointOne, pointTwo);

        // Neu doan qua dai (> maxInterpolationGapMeters) hoac qua ngan (< 3m), khong noi suy de tranh cong vo ly
        if (segmentDistance > maxInterpolationGapMeters || segmentDistance < 3) {
            smoothedPolyline.push(pointOne);
            continue;
        }

        const interpolatedSubSegment = interpolateCatmullRomSegment(
            pointZero,
            pointOne,
            pointTwo,
            pointThree,
            0.5,
            sampleIntervalMeters
        );

        for (let subIdx = 0; subIdx < interpolatedSubSegment.length; subIdx++) {
            const interpolatedCoord = interpolatedSubSegment[subIdx];
            const previousSmoothed = smoothedPolyline[smoothedPolyline.length - 1];
            if (
                !previousSmoothed ||
                calculateCoordinateDistanceMeters(previousSmoothed, interpolatedCoord) >= 0.5
            ) {
                smoothedPolyline.push(interpolatedCoord);
            }
        }
    }

    // Luon them diem cuoi cung
    const finalLastPoint = normalizedPoints[normalizedPoints.length - 1];
    const lastSmoothedPoint = smoothedPolyline[smoothedPolyline.length - 1];
    if (
        !lastSmoothedPoint ||
        calculateCoordinateDistanceMeters(lastSmoothedPoint, finalLastPoint) >= 0.5
    ) {
        smoothedPolyline.push(finalLastPoint);
    }

    return smoothedPolyline;
};
