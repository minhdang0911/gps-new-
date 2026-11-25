/**
 * smoothMarkerHelper.js
 * Quan ly Marker to ro, sac net, noi bat (Prominent Pin)
 * va ho tro truot vi tri muot ma (Smooth Sliding) cho xe tren Leaflet Map.
 */

/**
 * Tinh toan goc huong (Bearing/Azimuth 0 - 360 do) giua hai toa do GPS lien tiep
 */
export const calculateBearingFromPoints = (previousLatitude, previousLongitude, currentLatitude, currentLongitude) => {
    if (
        previousLatitude == null ||
        previousLongitude == null ||
        currentLatitude == null ||
        currentLongitude == null
    ) {
        return 0;
    }

    const lat1Rad = (previousLatitude * Math.PI) / 180;
    const lon1Rad = (previousLongitude * Math.PI) / 180;
    const lat2Rad = (currentLatitude * Math.PI) / 180;
    const lon2Rad = (currentLongitude * Math.PI) / 180;

    const deltaLon = lon2Rad - lon1Rad;
    const coordinateY = Math.sin(deltaLon) * Math.cos(lat2Rad);
    const coordinateX =
        Math.cos(lat1Rad) * Math.sin(lat2Rad) -
        Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(deltaLon);

    return ((Math.atan2(coordinateY, coordinateX) * 180) / Math.PI + 360) % 360;
};

/**
 * Tao Marker theo dung kich thuoc goc ban dau (34x60) va anchor goc [18, 36]
 * @param {Object} LMap - Thu vien Leaflet
 * @param {Object|string} iconAsset - Hinh anh icon marker xe (WebP)
 * @param {number} headingDegrees - Goc huong
 * @param {boolean} isMobile - Che do di dong
 */
export const createHeadingAwareIcon = (LMap, iconAsset, headingDegrees = 0, isMobile = false) => {
    if (!LMap) return null;

    const iconUrl = iconAsset?.src || iconAsset;
    const anchorPoint = isMobile ? [18, -15] : [18, 36];

    return LMap.icon({
        iconUrl: iconUrl,
        iconAnchor: anchorPoint,
        className: 'iky-prominent-marker-pin',
    });
};

/**
 * Cap nhat vi tri Marker truot muot ma giua cac diem telemetry
 * @param {Object} markerInstance - Leaflet Marker
 * @param {Object} newLatLng - Toa do moi L.latLng(lat, lon)
 * @param {number} headingDegrees - Goc huong
 */
export const updateMarkerSmoothMovement = (markerInstance, newLatLng, headingDegrees = null) => {
    if (!markerInstance || !newLatLng) return;

    try {
        const markerDomElement = markerInstance.getElement ? markerInstance.getElement() : markerInstance._icon;
        if (markerDomElement) {
            markerDomElement.style.transition = 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)';
        }
        markerInstance.setLatLng(newLatLng);
    } catch (_) {
        markerInstance.setLatLng(newLatLng);
    }
};
