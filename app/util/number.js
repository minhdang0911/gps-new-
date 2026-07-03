// lib/utils/number.js

export function toNumberOrNull(val) {
    if (val == null) return null;
    const n = Number(val);
    return isNaN(n) ? null : n;
}

// ─────────────────────────────────────────────────────────────
// Shared normalizers — single source of truth
// Import từ đây thay vì định nghĩa lại ở từng feature file
// ─────────────────────────────────────────────────────────────

/**
 * Normalize biển số xe: uppercase, xóa khoảng trắng, chuẩn hóa dấu phân cách.
 * Dùng nhất quán để tránh lệch kết quả filter giữa các module.
 * @example normalizePlate('51A - 123.45') // '51A-123-45'
 */
export const normalizePlate = (s) =>
    (s || '')
        .toString()
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '')
        .replace(/[._-]+/g, '-')
        .replace(/--+/g, '-');

/**
 * Lấy access token từ localStorage (safe SSR).
 * Đặt ở đây để tránh import chéo giữa các feature modules.
 */
export const getAuthToken = () => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('accessToken') || '';
};
