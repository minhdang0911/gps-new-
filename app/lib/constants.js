/**
 * Shared constants — dùng chung toàn app
 * ─────────────────────────────────────────
 * Thay vì hardcode giá trị ở nhiều nơi.
 */

/** Max limit khi fetch toàn bộ devices (tránh hardcode 200000 khắp nơi) */
export const MAX_DEVICE_LIMIT = 200_000;

/** Thời gian cache device list (ms) */
export const DEVICE_CACHE_STALE_MS = 5 * 60 * 1000; // 5 phút

/** Auto-refresh interval cho overview page (ms) */
export const OVERVIEW_AUTO_REFRESH_MS = 5 * 60 * 1000; // 5 phút

/** Khoảng cách xác định online (ms) — 24h */
export const ONLINE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

/** Ngưỡng cảnh báo hết hạn (ms) — 7 ngày */
export const EXPIRING_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;
