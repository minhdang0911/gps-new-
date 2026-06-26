/**
 * smoothMoveTo — animate Leaflet marker mượt mà giữa 2 tọa độ
 * Kỹ thuật tương tự Grab/Uber: dùng requestAnimationFrame + easing
 *
 * @param {Object} marker       - Leaflet marker instance
 * @param {number} toLat        - Tọa độ đích latitude
 * @param {number} toLon        - Tọa độ đích longitude
 * @param {number} durationMs   - Thời gian animate (ms), mặc định 300ms
 * @param {Function} easingFn   - Easing function, mặc định easeOutCubic
 * @param {Object} rafRef       - useRef để cancel animation cũ (tránh conflict)
 * @param {Function} onUpdate   - Callback mỗi frame (lat, lon) — dùng để pan map
 */
export function smoothMoveTo(marker, toLat, toLon, {
    durationMs = 300,
    easingFn = easeOutCubic,
    rafRef = null,
    onUpdate = null,
} = {}) {
    if (!marker) return;

    const fromLatLng = marker.getLatLng();
    const fromLat = fromLatLng.lat;
    const fromLon = fromLatLng.lng;

    // Không cần animate nếu khoảng cách quá nhỏ (< ~1m)
    const dlat = toLat - fromLat;
    const dlon = toLon - fromLon;
    if (Math.abs(dlat) < 0.000009 && Math.abs(dlon) < 0.000009) {
        marker.setLatLng([toLat, toLon]);
        if (onUpdate) onUpdate(toLat, toLon);
        return;
    }

    // Cancel animation đang chạy nếu có
    if (rafRef && rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
    }

    const startTime = performance.now();

    const frame = (now) => {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / durationMs);
        const eased = easingFn(t);

        const lat = fromLat + dlat * eased;
        const lon = fromLon + dlon * eased;

        marker.setLatLng([lat, lon]);
        if (onUpdate) onUpdate(lat, lon);

        if (t < 1) {
            const raf = requestAnimationFrame(frame);
            if (rafRef) rafRef.current = raf;
        } else {
            // Snap chính xác đến đích
            marker.setLatLng([toLat, toLon]);
            if (onUpdate) onUpdate(toLat, toLon);
            if (rafRef) rafRef.current = null;
        }
    };

    const raf = requestAnimationFrame(frame);
    if (rafRef) rafRef.current = raf;
}

// ─── Easing functions ──────────────────────────────────────────────────────
// Dùng cho click điểm (nhanh, snappy)
export function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

// Dùng cho playback liên tục (mượt đều)
export function easeLinear(t) {
    return t;
}

// Dùng cho drag slider (decelerate khi đến đích)
export function easeOutQuart(t) {
    return 1 - Math.pow(1 - t, 4);
}
